import type { D1 } from "@/lib/db/connection";
import { getEdgeCache } from "@/lib/http";
import { SITE_URL } from "@/lib/seo";

const VISITOR_COOKIE = "l2l_visitor";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 2;
const VISIT_DAY_COOKIE = "l2l_visit_day";
const VISIT_DAY_COOKIE_MAX_AGE = 60 * 60 * 24;

const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|preview|fetch|monitor|curl|wget|python|httpx|axios|node-fetch|go-http|java|headless|lighthouse/i;

export interface VisitorCounts {
  dailyVisitors: number;
  totalVisitors: number;
}

export async function getVisitorCounts(db: D1): Promise<VisitorCounts> {
  if (!db) return { dailyVisitors: 0, totalVisitors: 0 };

  try {
    const visitDate = getKstDate();
    // The layout asks for these counts on every page render, and COUNT(*) scans
    // the whole visitors table, so crawler traffic alone burns through the D1
    // read quota. A short edge cache bounds that; the key includes the KST date
    // so the daily figure resets at midnight instead of serving yesterday's.
    const cache = getEdgeCache();
    const cacheKey = new Request(`${SITE_URL}/__internal/visitor-counts?date=${visitDate}`);
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return (await cached.json()) as VisitorCounts;
    }

    const [dailyRow, totalRow] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) AS count FROM site_daily_visits WHERE visit_date = ?")
        .bind(visitDate)
        .first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM site_visitors").first<{ count: number }>()
    ]);

    const counts: VisitorCounts = {
      dailyVisitors: dailyRow?.count ?? 0,
      totalVisitors: totalRow?.count ?? 0
    };

    if (cache) {
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(counts), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300"
          }
        })
      );
    }
    return counts;
  } catch (error) {
    console.warn("Visitor counts are unavailable.", error);
    return { dailyVisitors: 0, totalVisitors: 0 };
  }
}

export async function recordVisit(db: D1, cookies: AstroCookies, request: Request): Promise<void> {
  if (!db) return;

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!userAgent || BOT_UA_PATTERN.test(userAgent)) return;

  const visitDate = getKstDate();
  // Day-guard cookie: after a successful record, repeat views the same KST day skip the writes.
  if (cookies.get(VISIT_DAY_COOKIE)?.value === visitDate && cookies.get(VISITOR_COOKIE)?.value) {
    return;
  }

  try {
    const visitorId = getOrSetVisitorId(cookies);

    await db
      .prepare(
        `INSERT INTO site_visitors (visitor_id) VALUES (?)
         ON CONFLICT(visitor_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`
      )
      .bind(visitorId)
      .run();

    await db
      .prepare(
        `INSERT INTO site_daily_visits (visitor_id, visit_date) VALUES (?, ?)
         ON CONFLICT(visitor_id, visit_date) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`
      )
      .bind(visitorId, visitDate)
      .run();

    cookies.set(VISIT_DAY_COOKIE, visitDate, {
      httpOnly: true,
      maxAge: VISIT_DAY_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: true
    });
  } catch (error) {
    // Cookie not set on failure, so the next page view retries.
    console.warn("Failed to record visit.", error);
  }
}

function getOrSetVisitorId(cookies: AstroCookies): string {
  const existing = cookies.get(VISITOR_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/i.test(existing)) return existing;

  const visitorId = crypto.randomUUID();
  cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    maxAge: VISITOR_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: true
  });
  return visitorId;
}

function getKstDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).format(new Date());
}

type AstroCookies = import("astro").AstroCookies;

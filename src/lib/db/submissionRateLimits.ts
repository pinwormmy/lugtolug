import type { D1 } from "@/lib/db/connection";

const SUBMISSION_DAILY_LIMIT = 10;
const SUBMISSION_EVENT_RETENTION_HOURS = 24;

export interface SubmissionRateLimit {
  limited: boolean;
  reason?: "daily";
  retryAfterSeconds?: number;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  ).trim() || "unknown";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pruneSubmissionRateEvents(db: D1): Promise<void> {
  if (!db) return;

  await db
    .prepare("DELETE FROM submission_rate_events WHERE created_at <= datetime('now', ?)")
    .bind(`-${SUBMISSION_EVENT_RETENTION_HOURS} hours`)
    .run();
}

export async function isSubmissionRateLimited(db: D1, request: Request): Promise<SubmissionRateLimit> {
  if (!db) return { limited: false };

  await pruneSubmissionRateEvents(db);
  const ipHash = await sha256Hex(getClientIp(request));
  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM submission_rate_events WHERE ip_hash = ? AND created_at > datetime('now', '-24 hours')")
    .bind(ipHash)
    .first<{ count: number }>();
  if (Number(countRow?.count ?? 0) >= SUBMISSION_DAILY_LIMIT) {
    return {
      limited: true,
      reason: "daily",
      retryAfterSeconds: 24 * 60 * 60
    };
  }

  return { limited: false };
}

export async function recordSubmissionRateLimit(db: D1, request: Request): Promise<void> {
  if (!db) return;

  const ipHash = await sha256Hex(getClientIp(request));
  await db.prepare("INSERT INTO submission_rate_events (ip_hash) VALUES (?)").bind(ipHash).run();
  await pruneSubmissionRateEvents(db);
}

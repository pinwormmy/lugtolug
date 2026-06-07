import type { D1 } from "@/lib/db/connection";
import type { SubmissionRateLimitRow } from "@/lib/db/rows";

const SUBMISSION_COOLDOWN_MS = 5 * 60 * 1000;
const SUBMISSION_DAILY_LIMIT = 10;

export interface SubmissionRateLimit {
  limited: boolean;
  reason?: "cooldown" | "daily";
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

export async function isSubmissionRateLimited(db: D1, request: Request): Promise<SubmissionRateLimit> {
  if (!db) return { limited: false };

  const ipHash = await sha256Hex(getClientIp(request));
  const row = await db
    .prepare("SELECT ip_hash, last_submitted_at FROM submission_rate_limits WHERE ip_hash = ?")
    .bind(ipHash)
    .first<SubmissionRateLimitRow>();
  if (!row) return { limited: false };

  const elapsed = Date.now() - new Date(row.last_submitted_at).getTime();
  if (elapsed < SUBMISSION_COOLDOWN_MS) {
    return {
      limited: true,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil((SUBMISSION_COOLDOWN_MS - elapsed) / 1000)
    };
  }

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
  await db
    .prepare(
      `INSERT INTO submission_rate_limits (ip_hash, last_submitted_at)
       VALUES (?, CURRENT_TIMESTAMP)
       ON CONFLICT(ip_hash) DO UPDATE SET last_submitted_at = excluded.last_submitted_at`
    )
    .bind(ipHash)
    .run();
  await db.prepare("INSERT INTO submission_rate_events (ip_hash) VALUES (?)").bind(ipHash).run();
}

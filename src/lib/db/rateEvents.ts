import type { D1 } from "@/lib/db/connection";

// Sliding-window counters shared by the public submission limit and the admin
// login throttle. Both live in the submission_rate_events table; keys are hashed
// with a scope prefix so the two limits never share a bucket. Rows older than the
// retention window are pruned on every check, so the table stays small without a
// scheduled job.

const EVENT_RETENTION_HOURS = 24;

export function getClientIp(request: Request): string {
  return (
    (
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"
    ).trim() || "unknown"
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Stable, non-reversible bucket id for a rate-limit key inside one scope. */
export function hashRateKey(scope: string, key: string): Promise<string> {
  return sha256Hex(`${scope}:${key}`);
}

export async function pruneRateEvents(db: D1): Promise<void> {
  if (!db) return;

  await db
    .prepare("DELETE FROM submission_rate_events WHERE created_at <= datetime('now', ?)")
    .bind(`-${EVENT_RETENTION_HOURS} hours`)
    .run();
}

export async function countRateEvents(db: D1, keyHash: string, windowMinutes: number): Promise<number> {
  if (!db) return 0;

  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM submission_rate_events WHERE ip_hash = ? AND created_at > datetime('now', ?)")
    .bind(keyHash, `-${windowMinutes} minutes`)
    .first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function recordRateEvent(db: D1, keyHash: string): Promise<void> {
  if (!db) return;

  await db.prepare("INSERT INTO submission_rate_events (ip_hash) VALUES (?)").bind(keyHash).run();
}

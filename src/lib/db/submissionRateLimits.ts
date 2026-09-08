import type { D1 } from "@/lib/db/connection";
import { countRateEvents, getClientIp, hashRateKey, pruneRateEvents, recordRateEvent } from "@/lib/db/rateEvents";

const SUBMISSION_DAILY_LIMIT = 10;
const SUBMISSION_WINDOW_MINUTES = 24 * 60;
const RATE_SCOPE = "submission";

export interface SubmissionRateLimit {
  limited: boolean;
  reason?: "daily";
  retryAfterSeconds?: number;
}

export async function isSubmissionRateLimited(db: D1, request: Request): Promise<SubmissionRateLimit> {
  if (!db) return { limited: false };

  await pruneRateEvents(db);
  const keyHash = await hashRateKey(RATE_SCOPE, getClientIp(request));
  const count = await countRateEvents(db, keyHash, SUBMISSION_WINDOW_MINUTES);
  if (count >= SUBMISSION_DAILY_LIMIT) {
    return {
      limited: true,
      reason: "daily",
      retryAfterSeconds: SUBMISSION_WINDOW_MINUTES * 60
    };
  }

  return { limited: false };
}

export async function recordSubmissionRateLimit(db: D1, request: Request): Promise<void> {
  if (!db) return;

  await recordRateEvent(db, await hashRateKey(RATE_SCOPE, getClientIp(request)));
  await pruneRateEvents(db);
}

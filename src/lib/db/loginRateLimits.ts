import type { D1 } from "@/lib/db/connection";
import { countRateEvents, getClientIp, hashRateKey, pruneRateEvents, recordRateEvent } from "@/lib/db/rateEvents";

// Failed admin logins per client address. PBKDF2 makes each guess expensive, but
// without a cap an attacker could still run an online dictionary attack against
// the operator account; this bounds it to a handful of guesses per window.
export const LOGIN_ATTEMPT_LIMIT = 10;
export const LOGIN_WINDOW_MINUTES = 15;
const RATE_SCOPE = "admin-login";

export interface LoginRateLimit {
  limited: boolean;
  retryAfterSeconds?: number;
}

export async function isLoginRateLimited(db: D1, request: Request): Promise<LoginRateLimit> {
  if (!db) return { limited: false };

  await pruneRateEvents(db);
  const keyHash = await hashRateKey(RATE_SCOPE, getClientIp(request));
  const count = await countRateEvents(db, keyHash, LOGIN_WINDOW_MINUTES);
  if (count >= LOGIN_ATTEMPT_LIMIT) {
    return { limited: true, retryAfterSeconds: LOGIN_WINDOW_MINUTES * 60 };
  }

  return { limited: false };
}

export async function recordFailedLogin(db: D1, request: Request): Promise<void> {
  if (!db) return;

  await recordRateEvent(db, await hashRateKey(RATE_SCOPE, getClientIp(request)));
}

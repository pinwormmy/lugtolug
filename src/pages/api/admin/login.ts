import type { APIRoute } from "astro";
import { createSession, makeSessionCookie, verifyPassword, verifyUnknownUserPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isLoginRateLimited, recordFailedLogin } from "@/lib/db/loginRateLimits";
import { redirect } from "@/lib/http";

// Generous upper bounds; real credentials are far shorter, and capping them keeps
// PBKDF2 from being fed arbitrarily large inputs.
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  if (!db) return redirect("/admin/login?error=db");

  const rateLimit = await isLoginRateLimited(db, request);
  if (rateLimit.limited) {
    return redirect("/admin/login?error=throttled");
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password || email.length > MAX_EMAIL_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    await recordFailedLogin(db, request);
    return redirect("/admin/login?error=invalid");
  }

  const user = await db
    .prepare("SELECT id, email, password_hash, salt, iterations FROM admin_users WHERE email = ?")
    .bind(email)
    .first<{ id: number; email: string; password_hash: string; salt: string; iterations: number }>();

  // Run the same amount of hashing work whether or not the account exists.
  const valid = user
    ? await verifyPassword(password, user.salt, user.iterations, user.password_hash)
    : await verifyUnknownUserPassword(password);

  if (!user || !valid) {
    await recordFailedLogin(db, request);
    return redirect("/admin/login?error=invalid");
  }

  const session = await createSession(db, user.id, request);
  const secureCookie = new URL(request.url).protocol === "https:";
  return redirect("/admin/submissions", {
    "Set-Cookie": makeSessionCookie(session.token, session.expires, secureCookie)
  });
};

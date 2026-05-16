import type { APIRoute } from "astro";
import { createSession, makeSessionCookie, verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = getDb(locals);
  if (!db) return redirect("/admin/login?error=db");

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db
    .prepare("SELECT id, email, password_hash, salt, iterations FROM admin_users WHERE email = ?")
    .bind(email)
    .first<{ id: number; email: string; password_hash: string; salt: string; iterations: number }>();

  if (!user || !(await verifyPassword(password, user.salt, user.iterations, user.password_hash))) {
    return redirect("/admin/login?error=invalid");
  }

  const session = await createSession(db, user.id, request);
  const secureCookie = new URL(request.url).protocol === "https:";
  return redirect("/admin/submissions", {
    "Set-Cookie": makeSessionCookie(session.token, session.expires, secureCookie)
  });
};

import type { APIRoute } from "astro";
import { clearSessionCookie, destroySession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, request }) => {
  await destroySession(getDb(locals), request);
  return redirect("/admin/login", {
    "Set-Cookie": clearSessionCookie()
  });
};

import type { APIRoute } from "astro";
import { getAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { recordVisit } from "@/lib/db/visitors";

export const POST: APIRoute = async ({ cookies, locals, request }) => {
  const db = getDb(locals);

  // Admin sessions are data-maintenance traffic, not visitors.
  const adminSession = await getAdminSession(db, request);
  if (!adminSession) {
    await recordVisit(db, cookies, request);
  }

  return new Response(null, { status: 204 });
};

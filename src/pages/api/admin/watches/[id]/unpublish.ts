import type { APIRoute } from "astro";
import { requireAdminWatch } from "@/lib/adminReview";
import { getDb, unpublishWatch } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requireAdminWatch(db, request, params.id);
  if (!result.ok) return result.response;

  await unpublishWatch(db, result.watch.id);
  return redirect(`/admin/watches/${result.watch.id}?pending=1`);
};

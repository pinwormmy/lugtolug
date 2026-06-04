import type { APIRoute } from "astro";
import { requireAdminWatch } from "@/lib/adminReview";
import { getDb, updateWatch } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requireAdminWatch(db, request, params.id);
  if (!result.ok) return result.response;

  const parsed = parseSubmission(result.form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/watches/${result.watch.id}?error=validation`);

  await updateWatch(db, result.watch.id, parsed.payload);
  return redirect("/");
};

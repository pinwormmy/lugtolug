import type { APIRoute } from "astro";
import { assertCsrfToken, requireAdmin } from "@/lib/auth";
import { getDb, getWatchById, updateWatch } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  const form = await request.formData();
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1 || !(await getWatchById(db, id))) {
    return redirect("/watches");
  }

  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/watches/${id}?error=validation`);

  await updateWatch(db, id, parsed.payload);
  return redirect("/");
};

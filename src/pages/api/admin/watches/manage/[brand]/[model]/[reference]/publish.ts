import type { APIRoute } from "astro";
import { assertCsrfToken, requireAdmin } from "@/lib/auth";
import { getDb, publishWatch } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  const form = await request.formData();
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));

  const manageHref = `/admin/watches/manage/${params.brand}/${params.model}/${params.reference}`;
  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) return redirect(`${manageHref}?error=validation`);

  const watchId = await publishWatch(db, parsed.payload);
  return redirect(`/admin/watches/${watchId}?updated=1`);
};

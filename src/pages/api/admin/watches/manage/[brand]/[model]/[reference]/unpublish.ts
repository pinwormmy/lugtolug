import type { APIRoute } from "astro";
import { requireAdminForm } from "@/lib/adminReview";
import { getDb, pendingWatch } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const gate = await requireAdminForm(db, request);
  if (!gate.ok) return gate.response;

  const manageHref = `/admin/watches/manage/${params.brand}/${params.model}/${params.reference}`;
  const parsed = parseSubmission(gate.form);
  if (!parsed.ok || !parsed.payload) return redirect(`${manageHref}?error=validation`);

  const watchId = await pendingWatch(db, parsed.payload);
  return redirect(`/admin/watches/${watchId}?pending=1`);
};

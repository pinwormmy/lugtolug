import type { APIRoute } from "astro";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { approveSubmission, getDb, getSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  await assertCsrf(session, request);

  const id = Number(params.id);
  const submission = await getSubmission(db, id);
  if (!submission) return redirect("/admin/submissions?error=missing");

  const form = await request.formData();
  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/submissions/${id}?error=validation`);

  await approveSubmission(db, id, parsed.payload, String(form.get("reviewerNote") ?? ""));
  return redirect("/admin/submissions?approved=1");
};

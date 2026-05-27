import type { APIRoute } from "astro";
import { readReviewerNote } from "@/lib/adminReview";
import { assertCsrfToken, requireAdmin } from "@/lib/auth";
import { getDb, getSubmission, updateApprovedSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const form = await request.formData();
  const session = await requireAdmin(db, request);
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));

  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id < 1) return redirect("/admin/submissions?error=missing");

  const submission = await getSubmission(db, id);
  if (!submission) return redirect("/admin/submissions?error=missing");
  if (submission.status !== "approved") return redirect("/admin/submissions?error=not-approved");

  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/submissions/${submission.id}?error=validation`);

  await updateApprovedSubmission(db, submission.id, submission.payload, parsed.payload, readReviewerNote(form));
  return redirect(`/admin/submissions/${submission.id}?updated=1`);
};

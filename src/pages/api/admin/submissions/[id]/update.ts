import type { APIRoute } from "astro";
import { readReviewerNote, requireApprovedSubmission } from "@/lib/adminReview";
import { getDb, updateApprovedSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requireApprovedSubmission(db, request, params.id);
  if (!result.ok) return result.response;

  const parsed = parseSubmission(result.form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/submissions/${result.submission.id}?error=validation`);

  await updateApprovedSubmission(
    db,
    result.submission.id,
    result.submission.payload,
    parsed.payload,
    readReviewerNote(result.form)
  );
  return redirect(`/admin/submissions/${result.submission.id}?updated=1`);
};

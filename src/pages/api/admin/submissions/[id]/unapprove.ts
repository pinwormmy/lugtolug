import type { APIRoute } from "astro";
import { readReviewerNote, requireApprovedSubmission } from "@/lib/adminReview";
import { getDb, returnSubmissionToPending } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requireApprovedSubmission(db, request, params.id);
  if (!result.ok) return result.response;

  const form = await request.formData();
  await returnSubmissionToPending(db, result.submission.id, result.submission.payload, readReviewerNote(form));
  return redirect("/admin/submissions?unapproved=1");
};

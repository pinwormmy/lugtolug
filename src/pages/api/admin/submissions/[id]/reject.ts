import type { APIRoute } from "astro";
import { readReviewerNote, requirePendingSubmission } from "@/lib/adminReview";
import { getDb, rejectSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requirePendingSubmission(db, request, params.id);
  if (!result.ok) return result.response;

  await rejectSubmission(db, result.submission.id, readReviewerNote(result.form));
  return redirect("/admin/submissions?rejected=1");
};

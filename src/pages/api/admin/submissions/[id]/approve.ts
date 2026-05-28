import type { APIRoute } from "astro";
import { readReviewerNote, requirePendingSubmission } from "@/lib/adminReview";
import { approveSubmission, getDb } from "@/lib/db";
import { redirect } from "@/lib/http";
import { parseSubmission } from "@/lib/validation";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const result = await requirePendingSubmission(db, request, params.id);
  if (!result.ok) return result.response;

  const form = await request.formData();
  const parsed = parseSubmission(form);
  if (!parsed.ok || !parsed.payload) return redirect(`/admin/submissions/${result.submission.id}?error=validation`);

  await approveSubmission(db, result.submission.id, parsed.payload, readReviewerNote(form));
  return redirect("/");
};

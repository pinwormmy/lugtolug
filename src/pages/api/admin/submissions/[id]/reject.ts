import type { APIRoute } from "astro";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { getDb, getSubmission, rejectSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";

export const POST: APIRoute = async ({ locals, params, request }) => {
  const db = getDb(locals);
  const session = await requireAdmin(db, request);
  await assertCsrf(session, request);
  const submission = await getSubmission(db, Number(params.id));
  if (!submission) return redirect("/admin/submissions?error=missing");
  if (submission.status !== "pending") return redirect("/admin/submissions?error=reviewed");
  const form = await request.formData();
  await rejectSubmission(db, submission.id, String(form.get("reviewerNote") ?? ""));
  return redirect("/admin/submissions?rejected=1");
};

import type { Submission } from "@/types";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { getSubmission } from "@/lib/db";
import { redirect } from "@/lib/http";

export type PendingSubmissionResult =
  | {
      ok: true;
      submission: Submission;
    }
  | {
      ok: false;
      response: Response;
    };

export async function requirePendingSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<PendingSubmissionResult> {
  const session = await requireAdmin(db, request);
  await assertCsrf(session, request);

  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  const submission = await getSubmission(db, id);
  if (!submission) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  if (submission.status !== "pending") {
    return { ok: false, response: redirect("/admin/submissions?error=reviewed") };
  }

  return { ok: true, submission };
}

export function readReviewerNote(form: FormData): string {
  return String(form.get("reviewerNote") ?? "").trim();
}

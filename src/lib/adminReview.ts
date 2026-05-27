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

export type SubmissionReviewResult = PendingSubmissionResult;

async function requireSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<SubmissionReviewResult> {
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

  return { ok: true, submission };
}

export async function requirePendingSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<PendingSubmissionResult> {
  const result = await requireSubmission(db, request, idParam);
  if (!result.ok) return result;

  if (result.submission.status !== "pending") {
    return { ok: false, response: redirect("/admin/submissions?error=reviewed") };
  }

  return result;
}

export async function requireApprovedSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<SubmissionReviewResult> {
  const result = await requireSubmission(db, request, idParam);
  if (!result.ok) return result;

  if (result.submission.status !== "approved") {
    return { ok: false, response: redirect("/admin/submissions?error=not-approved") };
  }

  return result;
}

export function readReviewerNote(form: FormData): string {
  return String(form.get("reviewerNote") ?? "").trim();
}

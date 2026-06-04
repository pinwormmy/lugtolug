import type { Submission, WatchWithSources } from "@/types";
import { assertCsrfToken, requireAdmin } from "@/lib/auth";
import { getSubmission, getWatchById } from "@/lib/db";
import { redirect } from "@/lib/http";

export type PendingSubmissionResult =
  | {
      ok: true;
      submission: Submission;
      form: FormData;
    }
  | {
      ok: false;
      response: Response;
    };

export type SubmissionReviewResult = PendingSubmissionResult;

export type AdminWatchResult =
  | {
      ok: true;
      watch: WatchWithSources;
      form: FormData;
    }
  | {
      ok: false;
      response: Response;
    };

async function requireSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<SubmissionReviewResult> {
  const session = await requireAdmin(db, request);
  const form = await request.formData();
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));

  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  const submission = await getSubmission(db, id);
  if (!submission) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  return { ok: true, submission, form };
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

export async function requireAdminWatch(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<AdminWatchResult> {
  const session = await requireAdmin(db, request);
  const form = await request.formData();
  assertCsrfToken(session, String(form.get("csrfToken") ?? ""));

  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { ok: false, response: redirect("/watches") };
  }

  const watch = await getWatchById(db, id);
  if (!watch) {
    return { ok: false, response: redirect("/watches") };
  }

  return { ok: true, watch, form };
}

export function readReviewerNote(form: FormData): string {
  return String(form.get("reviewerNote") ?? "").trim();
}

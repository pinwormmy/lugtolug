import type { Submission, WatchWithSources } from "@/types";
import { getAdminSession, isValidCsrfToken, type AdminSession } from "@/lib/auth";
import { getSubmission, getWatchById } from "@/lib/db";
import { redirect } from "@/lib/http";

export type AdminFormResult =
  | {
      ok: true;
      session: AdminSession;
      form: FormData;
    }
  | {
      ok: false;
      response: Response;
    };

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

/**
 * Gate for every state-changing admin endpoint: a live session cookie plus the
 * per-session CSRF token carried by the submitted form. Failures come back as a
 * response (redirect to login, 400, or 403) rather than an exception, so the
 * route can return it directly instead of surfacing a 500 page.
 */
export async function requireAdminForm(db: D1Database | undefined, request: Request): Promise<AdminFormResult> {
  const session = await getAdminSession(db, request);
  if (!session) {
    return { ok: false, response: redirect("/admin/login") };
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, response: new Response("Malformed form submission.", { status: 400 }) };
  }

  if (!isValidCsrfToken(session, String(form.get("csrfToken") ?? ""))) {
    return { ok: false, response: new Response("Invalid CSRF token.", { status: 403 }) };
  }

  return { ok: true, session, form };
}

async function requireSubmission(
  db: D1Database | undefined,
  request: Request,
  idParam: string | undefined
): Promise<SubmissionReviewResult> {
  const gate = await requireAdminForm(db, request);
  if (!gate.ok) return gate;

  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  const submission = await getSubmission(db, id);
  if (!submission) {
    return { ok: false, response: redirect("/admin/submissions?error=missing") };
  }

  return { ok: true, submission, form: gate.form };
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
  const gate = await requireAdminForm(db, request);
  if (!gate.ok) return gate;

  const id = Number(idParam);
  if (!Number.isSafeInteger(id) || id < 1) {
    return { ok: false, response: redirect("/watches") };
  }

  const watch = await getWatchById(db, id);
  if (!watch) {
    return { ok: false, response: redirect("/watches") };
  }

  return { ok: true, watch, form: gate.form };
}

export function readReviewerNote(form: FormData): string {
  return String(form.get("reviewerNote") ?? "").trim();
}

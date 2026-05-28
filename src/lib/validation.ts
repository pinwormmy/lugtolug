import type { SubmissionPayload } from "@/types";
import { NUMBER_LIMITS, REQUIRED_NUMBER_FIELDS, REQUIRED_SUBMISSION_FIELDS, TEXT_FIELDS, TEXT_LIMITS } from "@/lib/submissionFields";

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  payload?: SubmissionPayload;
}

export function parseSubmission(input: FormData | Record<string, unknown>): ValidationResult {
  const get = (key: string) => {
    if (input instanceof FormData) return input.get(key);
    return input[key];
  };
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | null> = {};

  for (const key of TEXT_FIELDS) {
    const value = String(get(key) ?? "").trim();
    if (REQUIRED_SUBMISSION_FIELDS.has(key) && !value) errors[key] = "Required";
    if (value.length > TEXT_LIMITS[key]) errors[key] = `Must be ${TEXT_LIMITS[key]} characters or fewer`;
    payload[key] = value;
  }

  for (const key of REQUIRED_NUMBER_FIELDS) {
    const raw = String(get(key) ?? "").trim();
    const limits = NUMBER_LIMITS[key];
    if (!raw && !REQUIRED_SUBMISSION_FIELDS.has(key)) {
      payload[key] = null;
      continue;
    }

    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      errors[key] = "Enter a positive number";
    } else if (value < limits.min || value > limits.max) {
      errors[key] = `Enter a value between ${limits.min} and ${limits.max}`;
    }
    payload[key] = value;
  }

  const sourceUrl = String(payload.sourceUrl ?? "");
  if (sourceUrl.length > TEXT_LIMITS.sourceUrl) {
    errors.sourceUrl = `Must be ${TEXT_LIMITS.sourceUrl} characters or fewer`;
  }

  const contactEmail = String(get("contactEmail") ?? "").trim();
  if (contactEmail.length > TEXT_LIMITS.contactEmail) {
    errors.contactEmail = `Must be ${TEXT_LIMITS.contactEmail} characters or fewer`;
  } else if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.contactEmail = "Enter a valid email";
  }

  const privateComment = String(get("privateComment") ?? "").trim();
  if (privateComment.length > TEXT_LIMITS.privateComment) {
    errors.privateComment = `Must be ${TEXT_LIMITS.privateComment} characters or fewer`;
  }
  const rawSubmissionType = String(get("submissionType") ?? "new-watch").trim();
  const submissionType = rawSubmissionType === "correction" ? "correction" : "new-watch";
  const rawReportedWatchId = String(get("reportedWatchId") ?? "").trim();
  let reportedWatchId: number | undefined;
  if (rawReportedWatchId) {
    const parsedReportedWatchId = Number(rawReportedWatchId);
    if (!Number.isSafeInteger(parsedReportedWatchId) || parsedReportedWatchId < 1) {
      errors.reportedWatchId = "Invalid watch";
    } else {
      reportedWatchId = parsedReportedWatchId;
    }
  }
  const reportedWatchPath = String(get("reportedWatchPath") ?? "").trim();
  if (reportedWatchPath.length > TEXT_LIMITS.reportedWatchPath) {
    errors.reportedWatchPath = `Must be ${TEXT_LIMITS.reportedWatchPath} characters or fewer`;
  }
  const ok = Object.keys(errors).length === 0;

  return {
    ok,
    errors,
    payload: ok
      ? {
          brand: String(payload.brand),
          model: String(payload.model),
          reference: String(payload.reference),
          sourceUrl,
          lugToLugMm: Number(payload.lugToLugMm),
          caseMm: payload.caseMm === null ? null : Number(payload.caseMm),
          thicknessMm: payload.thicknessMm === null ? null : Number(payload.thicknessMm),
          lugWidthMm: payload.lugWidthMm === null ? null : Number(payload.lugWidthMm),
          submissionType,
          reportedWatchId,
          reportedWatchPath: reportedWatchPath || undefined,
          contactEmail: contactEmail || undefined,
          privateComment: privateComment || undefined
        }
      : undefined
  };
}

import type { SubmissionPayload } from "@/types";
import { NUMBER_LIMITS, REQUIRED_NUMBER_FIELDS, REQUIRED_TEXT_FIELDS, TEXT_LIMITS } from "@/lib/submissionFields";

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
  const payload: Record<string, string | number> = {};

  for (const key of REQUIRED_TEXT_FIELDS) {
    const value = String(get(key) ?? "").trim();
    if (!value) errors[key] = "Required";
    if (value.length > TEXT_LIMITS[key]) errors[key] = `Must be ${TEXT_LIMITS[key]} characters or fewer`;
    payload[key] = value;
  }

  for (const key of REQUIRED_NUMBER_FIELDS) {
    const raw = String(get(key) ?? "").trim();
    const value = Number(raw);
    const limits = NUMBER_LIMITS[key];
    if (!Number.isFinite(value) || value <= 0) {
      errors[key] = "Enter a positive number";
    } else if (value < limits.min || value > limits.max) {
      errors[key] = `Enter a value between ${limits.min} and ${limits.max}`;
    }
    payload[key] = value;
  }

  const sourceUrl = String(payload.sourceUrl ?? "");
  try {
    const url = new URL(sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.sourceUrl = "Use an http or https URL";
    }
    if (sourceUrl.length > TEXT_LIMITS.sourceUrl) {
      errors.sourceUrl = `Must be ${TEXT_LIMITS.sourceUrl} characters or fewer`;
    }
  } catch {
    errors.sourceUrl = "Enter a valid URL";
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
          caseMm: Number(payload.caseMm),
          thicknessMm: Number(payload.thicknessMm),
          lugWidthMm: Number(payload.lugWidthMm),
          contactEmail: contactEmail || undefined,
          privateComment: privateComment || undefined
        }
      : undefined
  };
}

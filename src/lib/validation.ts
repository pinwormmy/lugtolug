import type { SubmissionPayload } from "@/types";

const REQUIRED_TEXT = ["brand", "model", "reference", "sourceUrl"] as const;
const REQUIRED_NUMBERS = ["lugToLugMm", "diameterMm", "thicknessMm", "lugWidthMm"] as const;
const TEXT_LIMITS = {
  brand: 80,
  model: 120,
  reference: 80,
  sourceUrl: 2048,
  privateComment: 1000,
  contactEmail: 320
} as const;
const NUMBER_LIMITS = {
  lugToLugMm: { min: 20, max: 80 },
  diameterMm: { min: 20, max: 60 },
  thicknessMm: { min: 4, max: 25 },
  lugWidthMm: { min: 8, max: 30 }
} as const;

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

  for (const key of REQUIRED_TEXT) {
    const value = String(get(key) ?? "").trim();
    if (!value) errors[key] = "Required";
    if (value.length > TEXT_LIMITS[key]) errors[key] = `Must be ${TEXT_LIMITS[key]} characters or fewer`;
    payload[key] = value;
  }

  for (const key of REQUIRED_NUMBERS) {
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
          diameterMm: Number(payload.diameterMm),
          thicknessMm: Number(payload.thicknessMm),
          lugWidthMm: Number(payload.lugWidthMm),
          contactEmail: contactEmail || undefined,
          privateComment: privateComment || undefined
        }
      : undefined
  };
}

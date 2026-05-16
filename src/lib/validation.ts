import type { SubmissionPayload } from "@/types";

const REQUIRED_TEXT = ["brand", "model", "reference", "sourceUrl"] as const;
const REQUIRED_NUMBERS = ["lugToLugMm", "diameterMm", "thicknessMm", "lugWidthMm"] as const;

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
    payload[key] = value;
  }

  for (const key of REQUIRED_NUMBERS) {
    const raw = String(get(key) ?? "").trim();
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      errors[key] = "Enter a positive number";
    }
    payload[key] = value;
  }

  const sourceUrl = String(payload.sourceUrl ?? "");
  try {
    const url = new URL(sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      errors.sourceUrl = "Use an http or https URL";
    }
  } catch {
    errors.sourceUrl = "Enter a valid URL";
  }

  const contactEmail = String(get("contactEmail") ?? "").trim();
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.contactEmail = "Enter a valid email";
  }

  const privateComment = String(get("privateComment") ?? "").trim();
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

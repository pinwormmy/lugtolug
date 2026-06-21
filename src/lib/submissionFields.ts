import type { SubmissionPayload } from "@/types";

export const TEXT_FIELDS = ["brand", "model", "reference", "sourceUrl"] as const;
export const NORMALIZATION_TEXT_FIELDS = ["canonicalModel", "modelGroup", "variant"] as const;
export const REQUIRED_TEXT_FIELDS = ["brand", "model", "reference"] as const;
export const REQUIRED_NUMBER_FIELDS = ["lugToLugMm", "caseMm", "thicknessMm", "lugWidthMm"] as const;
export const REQUIRED_SUBMISSION_FIELDS = new Set<string>(["model", "lugToLugMm"]);

export type TextField = (typeof TEXT_FIELDS)[number];
export type NormalizationTextField = (typeof NORMALIZATION_TEXT_FIELDS)[number];
export type RequiredTextField = (typeof REQUIRED_TEXT_FIELDS)[number];
export type RequiredNumberField = (typeof REQUIRED_NUMBER_FIELDS)[number];

export const TEXT_LIMITS = {
  brand: 80,
  model: 120,
  canonicalModel: 120,
  modelGroup: 140,
  variant: 120,
  reference: 80,
  sourceUrl: 2048,
  privateComment: 1000,
  contactEmail: 320,
  reportedWatchPath: 300
} as const satisfies Record<TextField | NormalizationTextField | "privateComment" | "contactEmail" | "reportedWatchPath", number>;

export const NUMBER_LIMITS = {
  lugToLugMm: { min: 20, max: 80 },
  caseMm: { min: 20, max: 60 },
  thicknessMm: { min: 4, max: 25 },
  lugWidthMm: { min: 8, max: 30 }
} as const satisfies Record<RequiredNumberField, { min: number; max: number }>;

export const REQUIRED_TEXT_INPUTS = [
  {
    name: "brand",
    label: "Brand",
    maxLength: TEXT_LIMITS.brand,
    autoComplete: "organization",
    type: "text"
  },
  {
    name: "model",
    label: "Watch name",
    maxLength: TEXT_LIMITS.model,
    autoComplete: undefined,
    type: "text"
  },
  {
    name: "reference",
    label: "Reference number",
    maxLength: TEXT_LIMITS.reference,
    autoComplete: undefined,
    type: "text"
  }
] as const satisfies readonly {
  name: RequiredTextField;
  label: string;
  maxLength: number;
  autoComplete?: string;
  type: "text";
}[];

export const PUBLIC_SUBMISSION_TEXT_INPUTS = REQUIRED_TEXT_INPUTS.filter((field) => field.name !== "reference");

export const OPTIONAL_PUBLIC_TEXT_INPUTS = [
  {
    name: "reference",
    label: "Reference number (optional)",
    maxLength: TEXT_LIMITS.reference,
    autoComplete: undefined,
    type: "text"
  }
] as const satisfies readonly {
  name: TextField;
  label: string;
  maxLength: number;
  autoComplete?: string;
  type: "text";
}[];

export const OPTIONAL_TEXT_INPUTS = [
  {
    name: "sourceUrl",
    label: "Source",
    maxLength: TEXT_LIMITS.sourceUrl,
    autoComplete: undefined,
    type: "text"
  }
] as const satisfies readonly {
  name: Exclude<TextField, RequiredTextField>;
  label: string;
  maxLength: number;
  autoComplete?: string;
  type: "text";
}[];

export const NORMALIZATION_TEXT_INPUTS = [
  {
    name: "canonicalModel",
    label: "Canonical model",
    maxLength: TEXT_LIMITS.canonicalModel,
    type: "text"
  },
  {
    name: "modelGroup",
    label: "Model group",
    maxLength: TEXT_LIMITS.modelGroup,
    type: "text"
  },
  {
    name: "variant",
    label: "Variant",
    maxLength: TEXT_LIMITS.variant,
    type: "text"
  }
] as const satisfies readonly {
  name: NormalizationTextField;
  label: string;
  maxLength: number;
  type: "text";
}[];

export const REQUIRED_NUMBER_INPUTS = [
  {
    name: "lugToLugMm",
    label: "Lug-to-lug mm",
    ...NUMBER_LIMITS.lugToLugMm
  },
  {
    name: "caseMm",
    label: "Case mm",
    ...NUMBER_LIMITS.caseMm
  },
  {
    name: "thicknessMm",
    label: "Thickness mm",
    ...NUMBER_LIMITS.thicknessMm
  },
  {
    name: "lugWidthMm",
    label: "Lug width mm",
    ...NUMBER_LIMITS.lugWidthMm
  }
] as const satisfies readonly {
  name: RequiredNumberField;
  label: string;
  min: number;
  max: number;
}[];

export const OPTIONAL_SUBMISSION_FIELDS = {
  privateComment: {
    name: "privateComment",
    label: "Private comment to operator",
    maxLength: TEXT_LIMITS.privateComment
  },
  contactEmail: {
    name: "contactEmail",
    label: "Email for follow-up, optional",
    maxLength: TEXT_LIMITS.contactEmail,
    type: "email"
  }
} as const;

export function getSubmissionFieldValue(
  payload: SubmissionPayload,
  name: TextField | NormalizationTextField | RequiredNumberField
): string | number {
  return payload[name] ?? "";
}

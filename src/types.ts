export type WatchStatus = "approved" | "draft" | "archived";
export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Watch {
  id: number;
  brand: string;
  model: string;
  reference: string;
  brandSlug: string;
  modelSlug: string;
  referenceSlug: string;
  lugToLugMm: number;
  caseMm: number | null;
  thicknessMm: number | null;
  lugWidthMm: number | null;
  confidence: "low" | "medium" | "high";
  status: WatchStatus;
  updatedAt: string;
}

export interface WatchSource {
  id: number;
  watchId: number;
  sourceUrl: string;
  note: string | null;
}

export interface WatchWithSources extends Watch {
  sources: WatchSource[];
}

export interface SubmissionPayload {
  brand: string;
  model: string;
  reference: string;
  lugToLugMm: number;
  caseMm: number | null;
  thicknessMm: number | null;
  lugWidthMm: number | null;
  sourceUrl: string;
  privateComment?: string;
  contactEmail?: string;
}

export interface Submission {
  id: number;
  payload: SubmissionPayload;
  status: SubmissionStatus;
  reviewerNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

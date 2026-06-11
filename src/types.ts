export type WatchStatus = "approved" | "pending" | "archived";
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
  submissionType?: "new-watch" | "correction";
  reportedWatchId?: number;
  reportedWatchPath?: string;
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

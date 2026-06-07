import type { Submission, SubmissionPayload, Watch, WatchSource } from "@/types";

export interface WatchRow {
  id: number;
  brand: string;
  model: string;
  reference: string;
  brand_slug: string;
  model_slug: string;
  reference_slug: string;
  lug_to_lug_mm: number;
  case_mm: number | null;
  thickness_mm: number | null;
  lug_width_mm: number | null;
  confidence: Watch["confidence"];
  status: Watch["status"] | "draft";
  updated_at: string;
}

export interface SourceRow {
  id: number;
  watch_id: number;
  source_url: string;
  note: string | null;
}

export interface SubmissionRow {
  id: number;
  payload_json: string;
  status: Submission["status"];
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SubmissionRateLimitRow {
  ip_hash: string;
  last_submitted_at: string;
}

export function mapWatch(row: WatchRow): Watch {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    reference: row.reference,
    brandSlug: row.brand_slug,
    modelSlug: row.model_slug,
    referenceSlug: row.reference_slug,
    lugToLugMm: row.lug_to_lug_mm,
    caseMm: row.case_mm,
    thicknessMm: row.thickness_mm,
    lugWidthMm: row.lug_width_mm,
    confidence: row.confidence,
    status: row.status === "draft" ? "pending" : row.status,
    updatedAt: row.updated_at
  };
}

export function mapSource(row: SourceRow): WatchSource {
  return {
    id: row.id,
    watchId: row.watch_id,
    sourceUrl: row.source_url,
    note: row.note
  };
}

export function mapSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    payload: JSON.parse(row.payload_json) as SubmissionPayload,
    status: row.status,
    reviewerNote: row.reviewer_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

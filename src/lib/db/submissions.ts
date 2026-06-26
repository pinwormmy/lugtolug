import type { Submission, SubmissionPayload } from "@/types";
import type { D1 } from "@/lib/db/connection";
import { mapSubmission, type SubmissionRow } from "@/lib/db/rows";
import {
  findWatchId,
  findWatchIdByProductIdentity,
  findWatchIdById,
  getSubmissionWatchSlugs,
  insertApprovedSource,
  updateWatchFromSubmission,
  upsertApprovedWatch
} from "@/lib/db/watches";

export async function createSubmission(db: D1, payload: SubmissionPayload): Promise<number> {
  if (!db) throw new Error("D1 database is required for submissions.");

  const result = await db
    .prepare("INSERT INTO submissions (payload_json, status) VALUES (?, 'pending')")
    .bind(JSON.stringify(payload))
    .run();
  return Number(result.meta.last_row_id);
}

export async function listSubmissions(db: D1, status: Submission["status"] | "all" = "pending"): Promise<Submission[]> {
  if (!db) return [];

  if (status === "all") {
    const rows = await db.prepare("SELECT * FROM submissions ORDER BY created_at DESC").all<SubmissionRow>();
    return rows.results.map(mapSubmission);
  }

  const rows = await db
    .prepare("SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC")
    .bind(status)
    .all<SubmissionRow>();
  return rows.results.map(mapSubmission);
}

export async function getSubmission(db: D1, id: number): Promise<Submission | null> {
  if (!db) return null;

  const row = await db.prepare("SELECT * FROM submissions WHERE id = ?").bind(id).first<SubmissionRow>();
  return row ? mapSubmission(row) : null;
}

export async function getApprovedSubmissionBySlugs(
  db: D1,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<Submission | null> {
  if (!db) return null;

  const rows = await db
    .prepare("SELECT * FROM submissions WHERE status = 'approved' ORDER BY reviewed_at DESC, id DESC")
    .all<SubmissionRow>();
  return (
    rows.results
      .map(mapSubmission)
      .find((submission) => {
        const slugs = getSubmissionWatchSlugs(submission.payload);
        return slugs.brandSlug === brandSlug && slugs.modelSlug === modelSlug && slugs.referenceSlug === referenceSlug;
      }) ?? null
  );
}

export async function approveSubmission(
  db: D1,
  id: number,
  payload: SubmissionPayload,
  reviewerNote: string
): Promise<number> {
  if (!db) throw new Error("D1 database is required.");

  const watchId = await upsertApprovedWatch(db, payload);
  await insertApprovedSource(db, watchId, payload.sourceUrl);
  await markSubmissionReviewed(db, id, "approved", reviewerNote);
  return watchId;
}

export async function updateApprovedSubmission(
  db: D1,
  id: number,
  currentPayload: SubmissionPayload,
  nextPayload: SubmissionPayload,
  reviewerNote: string
): Promise<number> {
  if (!db) throw new Error("D1 database is required.");

  const currentSlugs = getSubmissionWatchSlugs(currentPayload);
  const nextSlugs = getSubmissionWatchSlugs(nextPayload);
  const currentWatch = currentPayload.reportedWatchId
    ? await findWatchIdById(db, currentPayload.reportedWatchId)
    : (await findWatchId(db, currentSlugs)) ??
      (await findWatchIdByProductIdentity(db, currentSlugs.brandSlug, currentPayload.reference));
  let watchId: number;

  if (currentWatch) {
    await updateWatchFromSubmission(db, currentWatch.id, nextPayload, nextSlugs);
    watchId = currentWatch.id;
  } else {
    watchId = await upsertApprovedWatch(db, nextPayload);
  }

  await insertApprovedSource(db, watchId, nextPayload.sourceUrl);
  await db
    .prepare(
      `UPDATE submissions
       SET payload_json = ?, status = 'approved', reviewer_note = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(JSON.stringify(nextPayload), reviewerNote, id)
    .run();
  return watchId;
}

export async function returnSubmissionToPending(
  db: D1,
  id: number,
  payload: SubmissionPayload,
  reviewerNote: string
): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  const slugs = getSubmissionWatchSlugs(payload);
  const watch = payload.reportedWatchId
    ? await findWatchIdById(db, payload.reportedWatchId)
    : (await findWatchId(db, slugs)) ?? (await findWatchIdByProductIdentity(db, slugs.brandSlug, payload.reference));
  if (watch) {
    await db
      .prepare("UPDATE watches SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(watch.id)
      .run();
  }

  await db
    .prepare("UPDATE submissions SET status = 'pending', reviewer_note = ?, reviewed_at = NULL WHERE id = ?")
    .bind(reviewerNote, id)
    .run();
}

async function markSubmissionReviewed(
  db: D1Database,
  id: number,
  status: Extract<Submission["status"], "approved" | "rejected">,
  reviewerNote: string
): Promise<void> {
  await db
    .prepare("UPDATE submissions SET status = ?, reviewer_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(status, reviewerNote, id)
    .run();
}

export async function rejectSubmission(db: D1, id: number, reviewerNote: string): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  await markSubmissionReviewed(db, id, "rejected", reviewerNote);
}

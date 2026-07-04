import type { SubmissionPayload, WatchStatus } from "@/types";
import type { D1 } from "@/lib/db/connection";
import type { WatchRow } from "@/lib/db/rows";
import { slugify } from "@/lib/slug";
import { getWatchSearchText } from "@/lib/watch";
import { getReferenceProductIdentity } from "@/lib/watchIdentity";

export interface SubmissionWatchSlugs {
  brandSlug: string;
  modelSlug: string;
  referenceSlug: string;
  searchText: string;
}

export async function updateWatch(db: D1, id: number, payload: SubmissionPayload): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  await updateWatchFromSubmission(db, id, payload, getSubmissionWatchSlugs(payload));
  await insertApprovedSource(db, id, payload.sourceUrl);
}

export async function publishWatch(db: D1, payload: SubmissionPayload): Promise<number> {
  if (!db) throw new Error("D1 database is required.");

  const watchId = await upsertApprovedWatch(db, payload);
  await insertApprovedSource(db, watchId, payload.sourceUrl);
  return watchId;
}

export async function pendingWatch(db: D1, payload: SubmissionPayload): Promise<number> {
  if (!db) throw new Error("D1 database is required.");

  const slugs = getSubmissionWatchSlugs(payload);
  const existing =
    (await findWatchId(db, slugs)) ?? (await findWatchIdByProductIdentity(db, slugs.brandSlug, payload.reference));
  let watchId: number;

  if (existing) {
    await updateWatchFromSubmission(db, existing.id, payload, slugs, "pending");
    watchId = existing.id;
  } else {
    watchId = await insertWatchFromSubmission(db, payload, slugs, "pending");
  }

  await insertApprovedSource(db, watchId, payload.sourceUrl);
  return watchId;
}

export async function unpublishWatch(db: D1, id: number): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  await db.prepare("UPDATE watches SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
}

export async function upsertApprovedWatch(db: D1Database, payload: SubmissionPayload): Promise<number> {
  const slugs = getSubmissionWatchSlugs(payload);
  const reportedWatch = payload.reportedWatchId ? await findWatchIdById(db, payload.reportedWatchId) : null;
  if (reportedWatch) {
    await updateWatchFromSubmission(db, reportedWatch.id, payload, slugs);
    return reportedWatch.id;
  }

  const existing = await findWatchId(db, slugs);
  if (existing) {
    await updateWatchFromSubmission(db, existing.id, payload, slugs);
    return existing.id;
  }

  const productIdentityMatch = await findWatchIdByProductIdentity(db, slugs.brandSlug, payload.reference);
  if (productIdentityMatch) {
    await updateWatchFromSubmission(db, productIdentityMatch.id, payload, slugs);
    return productIdentityMatch.id;
  }

  return insertWatchFromSubmission(db, payload, slugs);
}

export function getSubmissionWatchSlugs(payload: SubmissionPayload): SubmissionWatchSlugs {
  const brandSlug = slugify(payload.brand) || "unknown-brand";
  const modelSlug = slugify(payload.model) || "watch";
  const referenceSlug = slugify(payload.reference) || "no-reference";
  const searchText = getWatchSearchText(payload);
  return { brandSlug, modelSlug, referenceSlug, searchText };
}

export async function findWatchId(db: D1Database, slugs: SubmissionWatchSlugs): Promise<{ id: number } | null> {
  return db
    .prepare("SELECT id FROM watches WHERE brand_slug = ? AND model_slug = ? AND reference_slug = ?")
    .bind(slugs.brandSlug, slugs.modelSlug, slugs.referenceSlug)
    .first<{ id: number }>();
}

export async function findWatchIdByProductIdentity(
  db: D1Database,
  brandSlug: string,
  reference: string
): Promise<{ id: number } | null> {
  const productIdentity = getReferenceProductIdentity({ brandSlug, reference });
  if (!productIdentity) return null;

  const rows = await db
    .prepare(
      `SELECT id, brand_slug, reference, status, updated_at FROM watches
       WHERE brand_slug = ? AND status != 'archived'
       ORDER BY CASE WHEN status = 'approved' THEN 0 ELSE 1 END, updated_at DESC, id DESC`
    )
    .bind(brandSlug)
    .all<Pick<WatchRow, "id" | "brand_slug" | "reference" | "status" | "updated_at">>();

  const match = rows.results.find(
    (row) => getReferenceProductIdentity({ brandSlug: row.brand_slug, reference: row.reference }) === productIdentity
  );
  return match ? { id: match.id } : null;
}

export async function findWatchIdById(db: D1Database, id: number): Promise<{ id: number } | null> {
  return db.prepare("SELECT id FROM watches WHERE id = ?").bind(id).first<{ id: number }>();
}

export async function updateWatchFromSubmission(
  db: D1Database,
  watchId: number,
  payload: SubmissionPayload,
  slugs: SubmissionWatchSlugs,
  status: WatchStatus = "approved"
): Promise<void> {
  const existing = await db
    .prepare("SELECT canonical_model, model_group, variant FROM watches WHERE id = ?")
    .bind(watchId)
    .first<Pick<WatchRow, "canonical_model" | "model_group" | "variant">>();
  const effectivePayload = {
    ...payload,
    canonicalModel: payload.canonicalModel ?? existing?.canonical_model ?? null,
    modelGroup: payload.modelGroup ?? existing?.model_group ?? null,
    variant: payload.variant ?? existing?.variant ?? null
  };
  const searchText = getWatchSearchText(effectivePayload);

  await db
    .prepare(
      `UPDATE watches
       SET brand = ?, model = ?, canonical_model = ?, model_group = ?, variant = ?,
           reference = ?, brand_slug = ?, model_slug = ?, reference_slug = ?, search_text = ?,
           lug_to_lug_mm = ?, case_mm = ?,
           thickness_mm = ?, lug_width_mm = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      payload.brand,
      payload.model,
      effectivePayload.canonicalModel,
      effectivePayload.modelGroup,
      effectivePayload.variant,
      payload.reference,
      slugs.brandSlug,
      slugs.modelSlug,
      slugs.referenceSlug,
      searchText,
      payload.lugToLugMm,
      payload.caseMm,
      payload.thicknessMm,
      payload.lugWidthMm,
      status,
      watchId
    )
    .run();
}

async function insertWatchFromSubmission(
  db: D1Database,
  payload: SubmissionPayload,
  slugs: SubmissionWatchSlugs,
  status: WatchStatus = "approved"
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO watches
       (brand, model, canonical_model, model_group, variant,
        reference, brand_slug, model_slug, reference_slug, search_text,
        lug_to_lug_mm, case_mm, thickness_mm, lug_width_mm, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      payload.brand,
      payload.model,
      payload.canonicalModel ?? null,
      payload.modelGroup ?? null,
      payload.variant ?? null,
      payload.reference,
      slugs.brandSlug,
      slugs.modelSlug,
      slugs.referenceSlug,
      slugs.searchText,
      payload.lugToLugMm,
      payload.caseMm,
      payload.thicknessMm,
      payload.lugWidthMm,
      status
    )
    .run();
  return Number(result.meta.last_row_id);
}

export async function insertApprovedSource(db: D1Database, watchId: number, sourceUrl: string): Promise<void> {
  if (!sourceUrl) return;

  await db
    .prepare(
      `INSERT INTO watch_sources (watch_id, source_url, note)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM watch_sources WHERE watch_id = ? AND source_url = ?
       )`
    )
    .bind(watchId, sourceUrl, "Approved user submission", watchId, sourceUrl)
    .run();
}

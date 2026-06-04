import type { SubmissionPayload, Watch, WatchSource, WatchWithSources } from "@/types";
import type { D1 } from "@/lib/db/connection";
import { mapSource, mapWatch, type SourceRow, type WatchRow } from "@/lib/db/rows";
import { normalizeSearch, slugify } from "@/lib/slug";
import { searchSeedWatches, seedWatches } from "@/lib/seed";
import { getSearchTokens, getWatchSearchText, watchMatchesSearchQuery } from "@/lib/watch";

export interface SubmissionWatchSlugs {
  brandSlug: string;
  modelSlug: string;
  referenceSlug: string;
  searchText: string;
}

export async function searchWatches(db: D1, query: string): Promise<WatchWithSources[]> {
  if (!db) return searchSeedWatches(query);

  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const tokens = getSearchTokens(query);
  const searchConditions = tokens.map(() => "search_text LIKE ?").join(" AND ");
  const rows = await db
    .prepare(`SELECT * FROM watches WHERE status = 'approved' AND ${searchConditions} ORDER BY brand, model LIMIT 50`)
    .bind(...tokens.map((token) => `%${token}%`))
    .all<WatchRow>();

  const watches = (await hydrateSources(db, rows.results.map(mapWatch))).filter((watch) =>
    watchMatchesSearchQuery(watch, query)
  );
  return mergeSeedWatches(watches, searchSeedWatches(query)).slice(0, 50);
}

export async function listWatches(db: D1): Promise<WatchWithSources[]> {
  if (!db) return seedWatches;

  const rows = await db.prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY brand, model").all<WatchRow>();
  return mergeSeedWatches(await hydrateSources(db, rows.results.map(mapWatch)), seedWatches);
}

export async function listRecentWatches(db: D1, limit = 5): Promise<WatchWithSources[]> {
  if (!db) return seedWatches.slice().sort((a, b) => b.id - a.id).slice(0, limit);

  const rows = await db
    .prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<WatchRow>();
  return mergeSeedWatches(await hydrateSources(db, rows.results.map(mapWatch)), seedWatches)
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);
}

export async function getWatchBySlugs(
  db: D1,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<WatchWithSources | null> {
  if (!db) return findSeedWatchBySlugs(brandSlug, modelSlug, referenceSlug);

  const row = await db
    .prepare(
      "SELECT * FROM watches WHERE status = 'approved' AND brand_slug = ? AND model_slug = ? AND reference_slug = ?"
    )
    .bind(brandSlug, modelSlug, referenceSlug)
    .first<WatchRow>();
  if (!row) return findSeedWatchBySlugs(brandSlug, modelSlug, referenceSlug);

  const [watch] = await hydrateSources(db, [mapWatch(row)]);
  return watch;
}

export async function getWatchById(db: D1, id: number): Promise<WatchWithSources | null> {
  if (!db) return seedWatches.find((watch) => watch.id === id) ?? null;

  const row = await db.prepare("SELECT * FROM watches WHERE id = ?").bind(id).first<WatchRow>();
  if (!row) return null;

  const [watch] = await hydrateSources(db, [mapWatch(row)]);
  return watch;
}

export async function listBrandWatches(db: D1, brandSlug: string): Promise<WatchWithSources[]> {
  if (!db) return seedWatches.filter((watch) => watch.brandSlug === brandSlug);

  const rows = await db
    .prepare("SELECT * FROM watches WHERE status = 'approved' AND brand_slug = ? ORDER BY model")
    .bind(brandSlug)
    .all<WatchRow>();
  return mergeSeedWatches(
    await hydrateSources(db, rows.results.map(mapWatch)),
    seedWatches.filter((watch) => watch.brandSlug === brandSlug)
  );
}

function findSeedWatchBySlugs(
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): WatchWithSources | null {
  return (
    seedWatches.find(
      (watch) =>
        watch.brandSlug === brandSlug && watch.modelSlug === modelSlug && watch.referenceSlug === referenceSlug
    ) ?? null
  );
}

function mergeSeedWatches(watches: WatchWithSources[], seeds: WatchWithSources[]): WatchWithSources[] {
  const merged = [...watches];
  const seen = new Set(watches.map(getWatchKey));
  for (const seed of seeds) {
    const key = getWatchKey(seed);
    if (seen.has(key)) continue;
    merged.push(seed);
    seen.add(key);
  }
  return merged.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
}

function getWatchKey(watch: Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">): string {
  return `${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

async function hydrateSources(db: D1Database, watches: Watch[]): Promise<WatchWithSources[]> {
  if (watches.length === 0) return [];

  const ids = watches.map((watch) => watch.id);
  const placeholders = ids.map(() => "?").join(",");
  const sourceRows = await db
    .prepare(`SELECT * FROM watch_sources WHERE watch_id IN (${placeholders}) ORDER BY id`)
    .bind(...ids)
    .all<SourceRow>();
  const byWatch = new Map<number, WatchSource[]>();
  for (const source of sourceRows.results.map(mapSource)) {
    const current = byWatch.get(source.watchId) ?? [];
    current.push(source);
    byWatch.set(source.watchId, current);
  }
  return watches.map((watch) => ({ ...watch, sources: byWatch.get(watch.id) ?? [] }));
}

export async function updateWatch(db: D1, id: number, payload: SubmissionPayload): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  await updateWatchFromSubmission(db, id, payload, getSubmissionWatchSlugs(payload));
  await insertApprovedSource(db, id, payload.sourceUrl);
}

export async function unpublishWatch(db: D1, id: number): Promise<void> {
  if (!db) throw new Error("D1 database is required.");

  await db.prepare("UPDATE watches SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
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

export async function findWatchIdById(db: D1Database, id: number): Promise<{ id: number } | null> {
  return db.prepare("SELECT id FROM watches WHERE id = ?").bind(id).first<{ id: number }>();
}

export async function updateWatchFromSubmission(
  db: D1Database,
  watchId: number,
  payload: SubmissionPayload,
  slugs: SubmissionWatchSlugs
): Promise<void> {
  await db
    .prepare(
      `UPDATE watches
       SET brand = ?, model = ?, reference = ?, brand_slug = ?, model_slug = ?, reference_slug = ?, search_text = ?,
           lug_to_lug_mm = ?, case_mm = ?,
           thickness_mm = ?, lug_width_mm = ?, confidence = 'medium', status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      payload.brand,
      payload.model,
      payload.reference,
      slugs.brandSlug,
      slugs.modelSlug,
      slugs.referenceSlug,
      slugs.searchText,
      payload.lugToLugMm,
      payload.caseMm,
      payload.thicknessMm,
      payload.lugWidthMm,
      watchId
    )
    .run();
}

async function insertWatchFromSubmission(
  db: D1Database,
  payload: SubmissionPayload,
  slugs: SubmissionWatchSlugs
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO watches
       (brand, model, reference, brand_slug, model_slug, reference_slug, search_text,
        lug_to_lug_mm, case_mm, thickness_mm, lug_width_mm, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'medium', 'approved')`
    )
    .bind(
      payload.brand,
      payload.model,
      payload.reference,
      slugs.brandSlug,
      slugs.modelSlug,
      slugs.referenceSlug,
      slugs.searchText,
      payload.lugToLugMm,
      payload.caseMm,
      payload.thicknessMm,
      payload.lugWidthMm
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

import type { Submission, SubmissionPayload, Watch, WatchSource, WatchWithSources } from "@/types";
import { normalizeSearch, slugify } from "@/lib/slug";
import { searchSeedWatches, seedWatches } from "@/lib/seed";
import { getWatchSearchText } from "@/lib/watch";

type D1 = D1Database | undefined;

interface WatchRow {
  id: number;
  brand: string;
  model: string;
  reference: string;
  brand_slug: string;
  model_slug: string;
  reference_slug: string;
  lug_to_lug_mm: number;
  case_mm: number;
  thickness_mm: number;
  lug_width_mm: number;
  confidence: Watch["confidence"];
  status: Watch["status"];
  updated_at: string;
}

interface SourceRow {
  id: number;
  watch_id: number;
  source_url: string;
  note: string | null;
}

interface SubmissionRow {
  id: number;
  payload_json: string;
  status: Submission["status"];
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface SubmissionRateLimitRow {
  ip_hash: string;
  last_submitted_at: string;
}

const SUBMISSION_COOLDOWN_MS = 5 * 60 * 1000;
const SUBMISSION_DAILY_LIMIT = 20;

interface SubmissionWatchSlugs {
  brandSlug: string;
  modelSlug: string;
  referenceSlug: string;
  searchText: string;
}

function mapWatch(row: WatchRow): Watch {
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
    status: row.status,
    updatedAt: row.updated_at
  };
}

function mapSource(row: SourceRow): WatchSource {
  return {
    id: row.id,
    watchId: row.watch_id,
    sourceUrl: row.source_url,
    note: row.note
  };
}

function mapSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    payload: JSON.parse(row.payload_json) as SubmissionPayload,
    status: row.status,
    reviewerNote: row.reviewer_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at
  };
}

export function getDb(locals: App.Locals): D1 {
  return locals.runtime?.env.DB;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  ).trim() || "unknown";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isSubmissionRateLimited(
  db: D1,
  request: Request
): Promise<{ limited: boolean; reason?: "cooldown" | "daily"; retryAfterSeconds?: number }> {
  if (!db) return { limited: false };

  const ipHash = await sha256Hex(getClientIp(request));
  const row = await db
    .prepare("SELECT ip_hash, last_submitted_at FROM submission_rate_limits WHERE ip_hash = ?")
    .bind(ipHash)
    .first<SubmissionRateLimitRow>();
  if (!row) return { limited: false };

  const elapsed = Date.now() - new Date(row.last_submitted_at).getTime();
  if (elapsed < SUBMISSION_COOLDOWN_MS) {
    return {
      limited: true,
      reason: "cooldown",
      retryAfterSeconds: Math.ceil((SUBMISSION_COOLDOWN_MS - elapsed) / 1000)
    };
  }

  const countRow = await db
    .prepare("SELECT COUNT(*) AS count FROM submission_rate_events WHERE ip_hash = ? AND created_at > datetime('now', '-24 hours')")
    .bind(ipHash)
    .first<{ count: number }>();
  if (Number(countRow?.count ?? 0) >= SUBMISSION_DAILY_LIMIT) {
    return {
      limited: true,
      reason: "daily",
      retryAfterSeconds: 24 * 60 * 60
    };
  }

  return { limited: false };
}

export async function recordSubmissionRateLimit(db: D1, request: Request): Promise<void> {
  if (!db) return;
  const ipHash = await sha256Hex(getClientIp(request));
  await db
    .prepare(
      `INSERT INTO submission_rate_limits (ip_hash, last_submitted_at)
       VALUES (?, CURRENT_TIMESTAMP)
       ON CONFLICT(ip_hash) DO UPDATE SET last_submitted_at = excluded.last_submitted_at`
    )
    .bind(ipHash)
    .run();
  await db.prepare("INSERT INTO submission_rate_events (ip_hash) VALUES (?)").bind(ipHash).run();
}

export async function searchWatches(db: D1, query: string): Promise<WatchWithSources[]> {
  if (!db) return searchSeedWatches(query);

  const normalized = normalizeSearch(query);
  const rows = normalized
    ? await db
        .prepare("SELECT * FROM watches WHERE status = 'approved' AND search_text LIKE ? ORDER BY brand, model LIMIT 50")
        .bind(`%${normalized}%`)
        .all<WatchRow>()
    : await db.prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY brand, model LIMIT 50").all<WatchRow>();

  return hydrateSources(db, rows.results.map(mapWatch));
}

export async function listWatches(db: D1): Promise<WatchWithSources[]> {
  if (!db) return seedWatches;
  const rows = await db.prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY brand, model").all<WatchRow>();
  return hydrateSources(db, rows.results.map(mapWatch));
}

export async function listRecentWatches(db: D1, limit = 5): Promise<WatchWithSources[]> {
  if (!db) return seedWatches.slice().sort((a, b) => b.id - a.id).slice(0, limit);
  const rows = await db
    .prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<WatchRow>();
  return hydrateSources(db, rows.results.map(mapWatch));
}

export async function getWatchBySlugs(
  db: D1,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<WatchWithSources | null> {
  if (!db) {
    return (
      seedWatches.find(
        (watch) =>
          watch.brandSlug === brandSlug && watch.modelSlug === modelSlug && watch.referenceSlug === referenceSlug
      ) ?? null
    );
  }

  const row = await db
    .prepare(
      "SELECT * FROM watches WHERE status = 'approved' AND brand_slug = ? AND model_slug = ? AND reference_slug = ?"
    )
    .bind(brandSlug, modelSlug, referenceSlug)
    .first<WatchRow>();
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
  return hydrateSources(db, rows.results.map(mapWatch));
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

export async function approveSubmission(db: D1, id: number, payload: SubmissionPayload, reviewerNote: string): Promise<number> {
  if (!db) throw new Error("D1 database is required.");
  const watchId = await upsertApprovedWatch(db, payload);

  await insertApprovedSource(db, watchId, payload.sourceUrl);
  await markSubmissionReviewed(db, id, "approved", reviewerNote);

  return watchId;
}

async function upsertApprovedWatch(db: D1Database, payload: SubmissionPayload): Promise<number> {
  const slugs = getSubmissionWatchSlugs(payload);
  const existing = await findWatchId(db, slugs);

  if (existing) {
    await updateWatchFromSubmission(db, existing.id, payload, slugs);
    return existing.id;
  }

  return insertWatchFromSubmission(db, payload, slugs);
}

function getSubmissionWatchSlugs(payload: SubmissionPayload): SubmissionWatchSlugs {
  const brandSlug = slugify(payload.brand);
  const modelSlug = slugify(payload.model);
  const referenceSlug = slugify(payload.reference);
  const searchText = getWatchSearchText(payload);
  return { brandSlug, modelSlug, referenceSlug, searchText };
}

async function findWatchId(db: D1Database, slugs: SubmissionWatchSlugs): Promise<{ id: number } | null> {
  return db
    .prepare("SELECT id FROM watches WHERE brand_slug = ? AND model_slug = ? AND reference_slug = ?")
    .bind(slugs.brandSlug, slugs.modelSlug, slugs.referenceSlug)
    .first<{ id: number }>();
}

async function updateWatchFromSubmission(
  db: D1Database,
  watchId: number,
  payload: SubmissionPayload,
  slugs: SubmissionWatchSlugs
): Promise<void> {
  await db
    .prepare(
      `UPDATE watches
       SET brand = ?, model = ?, reference = ?, search_text = ?, lug_to_lug_mm = ?, case_mm = ?,
           thickness_mm = ?, lug_width_mm = ?, confidence = 'medium', status = 'approved', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(
      payload.brand,
      payload.model,
      payload.reference,
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

async function insertApprovedSource(db: D1Database, watchId: number, sourceUrl: string): Promise<void> {
  await db
    .prepare("INSERT INTO watch_sources (watch_id, source_url, note) VALUES (?, ?, ?)")
    .bind(watchId, sourceUrl, "Approved user submission")
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

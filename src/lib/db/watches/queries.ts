import type { Watch, WatchStatus, WatchWithSources } from "@/types";
import type { D1 } from "@/lib/db/connection";
import { mapWatch, type WatchRow } from "@/lib/db/rows";
import { normalizeSearch } from "@/lib/slug";
import { searchSeedWatches, seedWatches } from "@/lib/seed";
import { getSearchTokens, watchMatchesSearchQuery } from "@/lib/watch";
import {
  buildPopularBrands,
  buildWatchDirectoryStats,
  rankSimilarWatches,
  type BrandSummary,
  type WatchDirectoryStats
} from "@/lib/watchDiscovery";
import type { WatchDisplayGroup } from "@/lib/watchGroups";
import {
  hydrateOne,
  hydrateSources,
  listSuppressedSeedMatches,
  mergeRecentSeedWatches,
  mergeSeedWatches,
  toWatchSummary
} from "@/lib/db/watches/merge";

const WATCH_BY_SLUGS_SQL = `SELECT * FROM watches
       WHERE brand_slug = ? AND model_slug = ? AND reference_slug = ?
       ORDER BY CASE WHEN status = 'approved' THEN 1 ELSE 0 END, updated_at DESC, id DESC
       LIMIT 1`;

function findWatchRowBySlugs(
  db: D1Database,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<WatchRow | null> {
  return db.prepare(WATCH_BY_SLUGS_SQL).bind(brandSlug, modelSlug, referenceSlug).first<WatchRow>();
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

// The seed is the complete public catalog, so when a D1 read fails (e.g. the
// free-tier daily read quota is exhausted, which errors every query until the
// midnight-UTC reset) public pages serve the seed instead of failing to render.
async function withSeedFallback<T>(fallback: () => T, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.warn("D1 read failed; serving the seed catalog instead.", error);
    return fallback();
  }
}

export async function searchWatches(db: D1, query: string): Promise<WatchWithSources[]> {
  if (!db) return searchSeedWatches(query);

  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  return withSeedFallback(() => searchSeedWatches(query).slice(0, 50), async () => {
    const tokens = getSearchTokens(query);
    const searchConditions = tokens.map(() => "search_text LIKE ?").join(" AND ");
    const rows = await db
      .prepare(`SELECT * FROM watches WHERE status = 'approved' AND ${searchConditions} ORDER BY brand, model LIMIT 50`)
      .bind(...tokens.map((token) => `%${token}%`))
      .all<WatchRow>();

    const watches = (await hydrateSources(db, rows.results.map(mapWatch))).filter((watch) =>
      watchMatchesSearchQuery(watch, query)
    );
    return mergeSeedWatches(watches, searchSeedWatches(query), await listSuppressedSeedMatches(db)).slice(0, 50);
  });
}

export async function listWatches(db: D1): Promise<WatchWithSources[]> {
  if (!db) return seedWatches;

  return withSeedFallback(() => seedWatches, async () => {
    const rows = await db.prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY brand, model").all<WatchRow>();
    return mergeSeedWatches(
      await hydrateSources(db, rows.results.map(mapWatch)),
      seedWatches,
      await listSuppressedSeedMatches(db)
    );
  });
}

// Search islands never read `sources`, so the search API skips source hydration
// (dozens of extra D1 reads on cache miss) and ships source-free records, roughly
// halving the JSON payload the client must download and parse before searching.
export async function listSearchWatches(db: D1): Promise<Watch[]> {
  if (!db) return seedWatches.map(toWatchSummary);

  return withSeedFallback(() => seedWatches.map(toWatchSummary), async () => {
    const rows = await db.prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY brand, model").all<WatchRow>();
    return mergeSeedWatches<Watch>(
      rows.results.map(mapWatch),
      seedWatches,
      await listSuppressedSeedMatches(db)
    ).map(toWatchSummary);
  });
}

// The seed catalog minus records retired in D1: the cheap read (~130 rows) the
// wrist and lug-to-lug guide pages use, since they need the whole catalog.
export async function listCatalogWatches(db: D1): Promise<Watch[]> {
  const fromSeed = () => seedWatches.map(toWatchSummary);
  if (!db) return fromSeed();

  return withSeedFallback(fromSeed, async () =>
    mergeSeedWatches<Watch>([], fromSeed(), await listSuppressedSeedMatches(db))
  );
}

export async function listRecentWatches(db: D1, limit = 5): Promise<WatchWithSources[]> {
  const fromSeed = () => seedWatches.slice().sort((a, b) => b.id - a.id).slice(0, limit);
  if (!db) return fromSeed();

  return withSeedFallback(fromSeed, async () => {
    const rows = await db
      .prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY updated_at DESC, id DESC LIMIT ?")
      .bind(limit)
      .all<WatchRow>();
    const watches = await hydrateSources(db, rows.results.map(mapWatch));
    return mergeRecentSeedWatches(watches, seedWatches, await listSuppressedSeedMatches(db), limit);
  });
}

export async function listRecentSearchWatches(db: D1, limit = 48): Promise<Watch[]> {
  const fromSeed = () =>
    seedWatches
      .slice()
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map(toWatchSummary);
  if (!db) return fromSeed();

  return withSeedFallback(fromSeed, async () => {
    const rows = await db
      .prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY updated_at DESC, id DESC LIMIT ?")
      .bind(limit)
      .all<WatchRow>();
    return mergeRecentSeedWatches(
      rows.results.map(mapWatch),
      seedWatches.map(toWatchSummary),
      await listSuppressedSeedMatches(db),
      limit
    );
  });
}

export async function listPopularBrands(_db: D1, limit = 12): Promise<BrandSummary[]> {
  // The checked-in seed is the complete public catalog; D1 can contain only
  // operator overrides and recent approvals, so it must not be treated as the
  // denominator for directory summaries.
  return buildPopularBrands(seedWatches, limit);
}

export async function getWatchDirectoryStats(_db: D1): Promise<WatchDirectoryStats> {
  return buildWatchDirectoryStats(seedWatches);
}

// The checked-in seed is the complete public catalog, so similarity ranking runs
// on seed candidates plus this many of the newest approved D1 rows (the ones that
// may not be folded into the seed yet) instead of proximity-scanning the table.
const SIMILAR_RECENT_APPROVED_LIMIT = 200;

export async function listSimilarWatches(db: D1, target: Watch, limit = 6): Promise<WatchDisplayGroup[]> {
  if (!db) return rankSimilarWatches(seedWatches, target, limit);

  return withSeedFallback(() => rankSimilarWatches(seedWatches, target, limit), async () => {
    const rows = await db
      .prepare("SELECT * FROM watches WHERE status = 'approved' ORDER BY updated_at DESC, id DESC LIMIT ?")
      .bind(SIMILAR_RECENT_APPROVED_LIMIT)
      .all<WatchRow>();

    const seedCandidates = seedWatches.filter((watch) => (
      Math.abs(watch.lugToLugMm - target.lugToLugMm) <= 6 &&
      (target.caseMm == null || watch.caseMm == null || Math.abs(watch.caseMm - target.caseMm) <= 8)
    ));
    const candidates = mergeSeedWatches<Watch>(
      rows.results.map(mapWatch),
      seedCandidates,
      await listSuppressedSeedMatches(db)
    );
    return rankSimilarWatches(candidates, target, limit);
  });
}

export async function listAdminWatches(db: D1, status: WatchStatus | "all" = "pending"): Promise<WatchWithSources[]> {
  if (!db) return [];

  const rows =
    status === "all"
      ? await db.prepare("SELECT * FROM watches ORDER BY updated_at DESC, id DESC").all<WatchRow>()
      : status === "pending"
        ? await db
            .prepare(
              "SELECT * FROM watches WHERE status = 'pending' OR status = 'draft' ORDER BY updated_at DESC, id DESC"
            )
            .all<WatchRow>()
        : await db
            .prepare("SELECT * FROM watches WHERE status = ? ORDER BY updated_at DESC, id DESC")
            .bind(status)
            .all<WatchRow>();

  return hydrateSources(db, rows.results.map(mapWatch));
}

export async function getWatchBySlugs(
  db: D1,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<WatchWithSources | null> {
  if (!db) return findSeedWatchBySlugs(brandSlug, modelSlug, referenceSlug);

  return withSeedFallback(() => findSeedWatchBySlugs(brandSlug, modelSlug, referenceSlug), async () => {
    const row = await findWatchRowBySlugs(db, brandSlug, modelSlug, referenceSlug);
    if (!row) return findSeedWatchBySlugs(brandSlug, modelSlug, referenceSlug);
    if (row.status !== "approved") return null;

    return hydrateOne(db, row);
  });
}

export async function getWatchById(db: D1, id: number): Promise<WatchWithSources | null> {
  if (!db) return seedWatches.find((watch) => watch.id === id) ?? null;

  const row = await db.prepare("SELECT * FROM watches WHERE id = ?").bind(id).first<WatchRow>();
  if (!row) return null;

  return hydrateOne(db, row);
}

export async function getEditableWatchBySlugs(
  db: D1,
  brandSlug: string,
  modelSlug: string,
  referenceSlug: string
): Promise<WatchWithSources | null> {
  if (!db) return null;

  const row = await findWatchRowBySlugs(db, brandSlug, modelSlug, referenceSlug);
  if (!row) return null;

  return hydrateOne(db, row);
}

export async function listBrandWatches(db: D1, brandSlug: string): Promise<WatchWithSources[]> {
  const fromSeed = () => seedWatches.filter((watch) => watch.brandSlug === brandSlug);
  if (!db) return fromSeed();

  return withSeedFallback(fromSeed, async () => {
    const rows = await db
      .prepare("SELECT * FROM watches WHERE status = 'approved' AND brand_slug = ? ORDER BY model")
      .bind(brandSlug)
      .all<WatchRow>();
    return mergeSeedWatches(
      await hydrateSources(db, rows.results.map(mapWatch)),
      fromSeed(),
      await listSuppressedSeedMatches(db, brandSlug)
    );
  });
}

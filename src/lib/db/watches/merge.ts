import type { Watch, WatchSource, WatchWithSources } from "@/types";
import { mapSource, mapWatch, type SourceRow, type WatchRow } from "@/lib/db/rows";
import { getReferenceProductIdentity } from "@/lib/watchIdentity";

type WatchKeyParts = Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">;
type WatchReferenceIdentityParts = Pick<Watch, "brandSlug" | "reference">;

export interface SuppressedSeedMatches {
  keys: Set<string>;
  referenceIdentities: Set<string>;
}

const SOURCE_HYDRATION_BATCH_SIZE = 100;

function getWatchKey(watch: WatchKeyParts): string {
  return `${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

function getWatchReferenceIdentity(watch: WatchReferenceIdentityParts): string | null {
  return getReferenceProductIdentity(watch);
}

function emptySuppressedSeedMatches(): SuppressedSeedMatches {
  return {
    keys: new Set(),
    referenceIdentities: new Set()
  };
}

// Strip `sources` down to the plain Watch record. The search API ships these so the
// client never downloads or parses source URLs and notes it does not use.
export function toWatchSummary(watch: Watch): Watch {
  return {
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    canonicalModel: watch.canonicalModel ?? null,
    modelGroup: watch.modelGroup ?? null,
    variant: watch.variant ?? null,
    reference: watch.reference,
    brandSlug: watch.brandSlug,
    modelSlug: watch.modelSlug,
    referenceSlug: watch.referenceSlug,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm,
    thicknessMm: watch.thicknessMm,
    lugWidthMm: watch.lugWidthMm,
    status: watch.status,
    updatedAt: watch.updatedAt
  };
}

export function mergeSeedWatches<T extends Watch>(
  watches: T[],
  seeds: T[],
  suppressedSeedMatches: SuppressedSeedMatches = emptySuppressedSeedMatches()
): T[] {
  const merged = [...watches];
  const seen = new Set(watches.map(getWatchKey));
  const seenReferenceIdentities = new Set(watches.map(getWatchReferenceIdentity).filter(Boolean));
  for (const seed of seeds) {
    const key = getWatchKey(seed);
    const referenceIdentity = getWatchReferenceIdentity(seed);
    if (
      seen.has(key) ||
      suppressedSeedMatches.keys.has(key) ||
      (referenceIdentity &&
        (seenReferenceIdentities.has(referenceIdentity) ||
          suppressedSeedMatches.referenceIdentities.has(referenceIdentity)))
    ) {
      continue;
    }
    merged.push(seed);
    seen.add(key);
    if (referenceIdentity) seenReferenceIdentities.add(referenceIdentity);
  }
  return merged.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model));
}

export function mergeRecentSeedWatches(
  watches: WatchWithSources[],
  seeds: WatchWithSources[],
  suppressedSeedMatches: SuppressedSeedMatches,
  limit: number
): WatchWithSources[] {
  const seen = new Set(watches.map(getWatchKey));
  const seenReferenceIdentities = new Set(watches.map(getWatchReferenceIdentity).filter(Boolean));
  const recentSeeds = seeds
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((seed) => {
      const key = getWatchKey(seed);
      const referenceIdentity = getWatchReferenceIdentity(seed);
      const shouldKeep =
        !seen.has(key) &&
        !suppressedSeedMatches.keys.has(key) &&
        (!referenceIdentity ||
          (!seenReferenceIdentities.has(referenceIdentity) &&
            !suppressedSeedMatches.referenceIdentities.has(referenceIdentity)));

      if (shouldKeep && referenceIdentity) seenReferenceIdentities.add(referenceIdentity);
      return shouldKeep;
    });

  const emptySlots = Math.max(0, limit - watches.length);
  const reservedSeedSlots =
    emptySlots > 0 ? emptySlots : recentSeeds.length > 0 && limit > 1 ? Math.min(Math.ceil(limit / 3), limit - 1) : 0;
  const dbSlots = Math.max(0, limit - reservedSeedSlots);

  return [...watches.slice(0, dbSlots), ...recentSeeds.slice(0, reservedSeedSlots)].slice(0, limit);
}

export async function listSuppressedSeedMatches(db: D1Database, brandSlug?: string): Promise<SuppressedSeedMatches> {
  const query = brandSlug
    ? "SELECT brand_slug, model_slug, reference_slug, reference FROM watches WHERE status != 'approved' AND brand_slug = ?"
    : "SELECT brand_slug, model_slug, reference_slug, reference FROM watches WHERE status != 'approved'";
  const statement = db.prepare(query);
  const rows = brandSlug
    ? await statement.bind(brandSlug).all<Pick<WatchRow, "brand_slug" | "model_slug" | "reference_slug" | "reference">>()
    : await statement.all<Pick<WatchRow, "brand_slug" | "model_slug" | "reference_slug" | "reference">>();

  return rows.results.reduce((matches, row) => {
    matches.keys.add(
      getWatchKey({
        brandSlug: row.brand_slug,
        modelSlug: row.model_slug,
        referenceSlug: row.reference_slug
      })
    );

    const referenceIdentity = getReferenceProductIdentity({
      brandSlug: row.brand_slug,
      reference: row.reference
    });
    if (referenceIdentity) matches.referenceIdentities.add(referenceIdentity);

    return matches;
  }, emptySuppressedSeedMatches());
}

export async function hydrateSources(db: D1Database, watches: Watch[]): Promise<WatchWithSources[]> {
  if (watches.length === 0) return [];

  const sourceRows: SourceRow[] = [];
  for (let index = 0; index < watches.length; index += SOURCE_HYDRATION_BATCH_SIZE) {
    const ids = watches.slice(index, index + SOURCE_HYDRATION_BATCH_SIZE).map((watch) => watch.id);
    const placeholders = ids.map(() => "?").join(",");
    const rows = await db
      .prepare(`SELECT * FROM watch_sources WHERE watch_id IN (${placeholders}) ORDER BY id`)
      .bind(...ids)
      .all<SourceRow>();
    sourceRows.push(...rows.results);
  }

  const byWatch = new Map<number, WatchSource[]>();
  for (const source of sourceRows.map(mapSource)) {
    const current = byWatch.get(source.watchId) ?? [];
    current.push(source);
    byWatch.set(source.watchId, current);
  }
  return watches.map((watch) => ({ ...watch, sources: byWatch.get(watch.id) ?? [] }));
}

// Hydrate a single row's sources. Shared by the by-id / by-slug single-watch lookups.
export async function hydrateOne(db: D1Database, row: WatchRow): Promise<WatchWithSources> {
  const [watch] = await hydrateSources(db, [mapWatch(row)]);
  return watch;
}

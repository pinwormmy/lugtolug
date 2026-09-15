import priority from "../../data/brand-priority.json";

// Public listings surface major brands before the long tail of microbrands and
// catalog imports (a single official-catalog import can add hundreds of records
// for one brand and would otherwise dominate every "popular" and "recent" list).
// The tiers live in data/brand-priority.json so they can be edited without
// touching code; getBrandRank turns them into a sort key.

export const MAJOR_BRAND_RANK = 0;
export const ESTABLISHED_BRAND_RANK = 1;
export const OTHER_BRAND_RANK = 2;

const rankBySlug = new Map<string, number>();
const orderBySlug = new Map<string, number>();
for (const slug of priority.tier1) rankBySlug.set(slug, MAJOR_BRAND_RANK);
for (const slug of priority.tier2) {
  if (!rankBySlug.has(slug)) rankBySlug.set(slug, ESTABLISHED_BRAND_RANK);
}
[...priority.tier1, ...priority.tier2].forEach((slug, index) => {
  if (!orderBySlug.has(slug)) orderBySlug.set(slug, index);
});

function lookup(map: Map<string, number>, brandSlug: string): number | undefined {
  const direct = map.get(brandSlug);
  if (direct != null) return direct;

  // Collaboration records are slugged as "brand-x-partner"; rank them with the brand.
  const collaborationIndex = brandSlug.indexOf("-x-");
  return collaborationIndex > 0 ? map.get(brandSlug.slice(0, collaborationIndex)) : undefined;
}

export const BRAND_PRIORITY_TIERS: { tier1: readonly string[]; tier2: readonly string[] } = priority;

/** Lower is shown first: 0 for major brands, 1 for established ones, 2 for the rest. */
export function getBrandRank(brandSlug: string): number {
  return lookup(rankBySlug, brandSlug) ?? OTHER_BRAND_RANK;
}

/**
 * Position in the curated list (tier1 then tier2); unlisted brands sort last.
 * Collaborations do not inherit here, so a brand directory lists "Omega" but
 * not "Omega x Swatch" next to it.
 */
export function getBrandOrder(brandSlug: string): number {
  return orderBySlug.get(brandSlug) ?? Number.POSITIVE_INFINITY;
}

export function isMajorBrand(brandSlug: string): boolean {
  return getBrandRank(brandSlug) === MAJOR_BRAND_RANK;
}

/** Sort comparator: major brands first, then established, then everything else. Ties are left to the caller. */
export function compareBrandPriority(a: { brandSlug: string }, b: { brandSlug: string }): number {
  return getBrandRank(a.brandSlug) - getBrandRank(b.brandSlug);
}

/** Sort comparator following the curated list order itself, for brand directories. */
export function compareBrandOrder(a: { brandSlug: string }, b: { brandSlug: string }): number {
  const difference = getBrandOrder(a.brandSlug) - getBrandOrder(b.brandSlug);
  return Number.isNaN(difference) ? 0 : difference;
}

/** Stable reorder that keeps the input order inside each tier. */
export function prioritizeMajorBrands<T extends { brandSlug: string }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index, rank: getBrandRank(item.brandSlug) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * Take up to `limit` items in priority order while letting each brand appear at
 * most `maxPerBrand` times; if the cap leaves the list short, top it up with the
 * remaining items in order. Keeps a single large import from filling a list.
 */
export function pickWithBrandCap<T extends { brandSlug: string }>(items: readonly T[], limit: number, maxPerBrand: number): T[] {
  const prioritized = prioritizeMajorBrands(items);
  const perBrand = new Map<string, number>();
  const picked: T[] = [];
  const skipped: T[] = [];

  for (const item of prioritized) {
    if (picked.length >= limit) break;
    const used = perBrand.get(item.brandSlug) ?? 0;
    if (used >= maxPerBrand) {
      skipped.push(item);
      continue;
    }
    perBrand.set(item.brandSlug, used + 1);
    picked.push(item);
  }

  return picked.length < limit ? [...picked, ...skipped.slice(0, limit - picked.length)] : picked;
}

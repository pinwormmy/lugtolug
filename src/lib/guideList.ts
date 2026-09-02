import type { Watch } from "@/types";
import { watchMatchesSearchQuery } from "@/lib/watch";
import { getWatchGenre, matchesGenre } from "@/lib/wristGuide";

// Filtering shared by the guide pages (server-rendered lists) and their
// in-page search island, so a query returns the same set the page describes.

export type GuideListSort = "sweet-spot" | "newest";

export interface GuideListOptions {
  minMm?: number;
  maxMm?: number;
  /** Treat `maxMm` as exclusive (lug-to-lug collections) instead of inclusive (wrist bands). */
  maxExclusive?: boolean;
  genreSlug?: string;
  query?: string;
  sort: GuideListSort;
  sweetSpotMm?: number;
}

function byName(a: Watch, b: Watch): number {
  return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.reference.localeCompare(b.reference);
}

/** One entry per model family, keeping the input order (first occurrence wins). */
export function uniqueByModel<T extends Watch>(watches: T[], limit = Number.POSITIVE_INFINITY): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const watch of watches) {
    const key = `${watch.brandSlug}/${watch.modelGroup ?? watch.modelSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(watch);
    if (result.length >= limit) break;
  }
  return result;
}

export function filterGuideWatches(watches: Watch[], options: GuideListOptions): Watch[] {
  const genre = options.genreSlug ? getWatchGenre(options.genreSlug) : null;
  const query = options.query?.trim() ?? "";

  const matches = watches.filter((watch) => (
    (options.minMm == null || watch.lugToLugMm >= options.minMm) &&
    (options.maxMm == null || (options.maxExclusive ? watch.lugToLugMm < options.maxMm : watch.lugToLugMm <= options.maxMm)) &&
    (!genre || matchesGenre(watch, genre)) &&
    (query === "" || watchMatchesSearchQuery(watch, query))
  ));

  if (options.sort === "newest") {
    matches.sort((a, b) => b.id - a.id);
  } else {
    const sweetSpot = options.sweetSpotMm ?? ((options.minMm ?? 0) + (options.maxMm ?? 0)) / 2;
    matches.sort((a, b) => Math.abs(a.lugToLugMm - sweetSpot) - Math.abs(b.lugToLugMm - sweetSpot) || byName(a, b));
  }

  return uniqueByModel(matches);
}

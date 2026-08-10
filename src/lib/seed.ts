import seed from "../../data/watches.seed.json";
import type { WatchWithSources } from "@/types";
import { getWatchSlugs, normalizeOptionalString } from "@/lib/slug";
import { watchMatchesSearchQuery } from "@/lib/watch";

interface SeedSource {
  sourceUrl: string;
  note?: string;
}

export const seedWatches: WatchWithSources[] = seed.map((watch) => {
  const slugs = getWatchSlugs(watch);

  return {
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    canonicalModel: normalizeOptionalString("canonicalModel" in watch ? watch.canonicalModel : null),
    modelGroup: normalizeOptionalString("modelGroup" in watch ? watch.modelGroup : null),
    variant: normalizeOptionalString("variant" in watch ? watch.variant : null),
    reference: watch.reference,
    ...slugs,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm,
    thicknessMm: watch.thicknessMm,
    lugWidthMm: watch.lugWidthMm,
    status: "approved",
    updatedAt: new Date().toISOString(),
    sources: watch.sources.map((source: SeedSource, index: number) => ({
      id: index + 1,
      watchId: watch.id,
      sourceUrl: source.sourceUrl,
      note: source.note ?? null
    }))
  };
});

export function searchSeedWatches(query: string): WatchWithSources[] {
  return seedWatches.filter((watch) => watchMatchesSearchQuery(watch, query));
}

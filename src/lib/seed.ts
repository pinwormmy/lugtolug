import seed from "../../data/watches.seed.json";
import type { WatchWithSources } from "@/types";
import { slugify } from "@/lib/slug";
import { watchMatchesSearchQuery } from "@/lib/watch";

export const seedWatches: WatchWithSources[] = seed.map((watch) => ({
  id: watch.id,
  brand: watch.brand,
  model: watch.model,
  reference: watch.reference,
  brandSlug: slugify(watch.brand),
  modelSlug: slugify(watch.model),
  referenceSlug: slugify(watch.reference),
  lugToLugMm: watch.lugToLugMm,
  caseMm: watch.caseMm,
  thicknessMm: watch.thicknessMm,
  lugWidthMm: watch.lugWidthMm,
  status: "approved",
  updatedAt: new Date().toISOString(),
  sources: watch.sources.map((source, index) => ({
    id: index + 1,
    watchId: watch.id,
    sourceUrl: source.sourceUrl,
    note: source.note
  }))
}));

export function searchSeedWatches(query: string): WatchWithSources[] {
  return seedWatches.filter((watch) => watchMatchesSearchQuery(watch, query));
}

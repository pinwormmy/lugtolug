import seed from "../../data/watches.seed.json";
import type { WatchWithSources } from "@/types";
import { normalizeSearch, slugify } from "@/lib/slug";
import { getWatchSearchText } from "@/lib/watch";

export const seedWatches: WatchWithSources[] = seed.map((watch) => ({
  id: watch.id,
  brand: watch.brand,
  model: watch.model,
  reference: watch.reference,
  brandSlug: slugify(watch.brand),
  modelSlug: slugify(watch.model),
  referenceSlug: slugify(watch.reference),
  lugToLugMm: watch.lugToLugMm,
  diameterMm: watch.diameterMm,
  thicknessMm: watch.thicknessMm,
  lugWidthMm: watch.lugWidthMm,
  confidence: watch.confidence as WatchWithSources["confidence"],
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
  const normalized = normalizeSearch(query);
  if (!normalized) return seedWatches;
  return seedWatches.filter((watch) => getWatchSearchText(watch).includes(normalized));
}

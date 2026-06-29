import seed from "../../data/watches.seed.json";
import type { WatchWithSources } from "@/types";
import { slugify } from "@/lib/slug";
import { watchMatchesSearchQuery } from "@/lib/watch";

interface SeedSource {
  sourceUrl: string;
  note?: string;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export const seedWatches: WatchWithSources[] = seed.map((watch) => ({
  id: watch.id,
  brand: watch.brand,
  model: watch.model,
  canonicalModel: optionalString("canonicalModel" in watch ? watch.canonicalModel : null),
  modelGroup: optionalString("modelGroup" in watch ? watch.modelGroup : null),
  variant: optionalString("variant" in watch ? watch.variant : null),
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
  sources: watch.sources.map((source: SeedSource, index: number) => ({
    id: index + 1,
    watchId: watch.id,
    sourceUrl: source.sourceUrl,
    note: source.note
  }))
}));

export function searchSeedWatches(query: string): WatchWithSources[] {
  return seedWatches.filter((watch) => watchMatchesSearchQuery(watch, query));
}

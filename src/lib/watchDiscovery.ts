import type { Watch } from "@/types";
import { groupWatchesForDisplay, type WatchDisplayGroup } from "@/lib/watchGroups";

export interface BrandSummary {
  brand: string;
  brandSlug: string;
  watchCount: number;
}

export interface WatchDirectoryStats {
  totalRecords: number;
  brandCount: number;
  lugToLugUnder42: number;
  lugToLugUnder44: number;
  lugToLugUnder46: number;
  thicknessUnder10: number;
}

export function buildPopularBrands(watches: Watch[], limit = 12): BrandSummary[] {
  const brands = new Map<string, BrandSummary>();

  for (const watch of watches) {
    const current = brands.get(watch.brandSlug);
    if (current) {
      current.watchCount += 1;
    } else {
      brands.set(watch.brandSlug, {
        brand: watch.brand,
        brandSlug: watch.brandSlug,
        watchCount: 1
      });
    }
  }

  return [...brands.values()]
    .sort((a, b) => b.watchCount - a.watchCount || a.brand.localeCompare(b.brand))
    .slice(0, limit);
}

export function buildWatchDirectoryStats(watches: Watch[]): WatchDirectoryStats {
  return {
    totalRecords: watches.length,
    brandCount: new Set(watches.map((watch) => watch.brandSlug)).size,
    lugToLugUnder42: watches.filter((watch) => watch.lugToLugMm <= 42).length,
    lugToLugUnder44: watches.filter((watch) => watch.lugToLugMm <= 44).length,
    lugToLugUnder46: watches.filter((watch) => watch.lugToLugMm <= 46).length,
    thicknessUnder10: watches.filter((watch) => watch.thicknessMm != null && watch.thicknessMm <= 10).length
  };
}

function modelFamilyKey(watch: Watch): string {
  return watch.modelGroup
    ? `${watch.brandSlug}/group/${watch.modelGroup}`
    : `${watch.brandSlug}/model/${watch.modelSlug}`;
}

function metricDistance(left: number | null, right: number | null, weight: number): number {
  if (left == null || right == null) return 0;
  return Math.abs(left - right) * weight;
}

function similarityDistance(candidate: Watch, target: Watch): number {
  return (
    metricDistance(candidate.lugToLugMm, target.lugToLugMm, 3) +
    metricDistance(candidate.caseMm, target.caseMm, 1.25) +
    metricDistance(candidate.thicknessMm, target.thicknessMm, 0.35) +
    metricDistance(candidate.lugWidthMm, target.lugWidthMm, 0.2)
  );
}

export function rankSimilarWatches(watches: Watch[], target: Watch, limit = 6): WatchDisplayGroup[] {
  const targetFamily = modelFamilyKey(target);
  const candidates = watches.filter((watch) => (
    watch.id !== target.id &&
    modelFamilyKey(watch) !== targetFamily &&
    !(
      watch.brandSlug === target.brandSlug &&
      watch.modelSlug === target.modelSlug &&
      watch.referenceSlug === target.referenceSlug
    )
  ));

  return groupWatchesForDisplay(candidates)
    .sort((a, b) => (
      similarityDistance(a, target) - similarityDistance(b, target) ||
      a.brand.localeCompare(b.brand) ||
      a.model.localeCompare(b.model)
    ))
    .slice(0, limit);
}

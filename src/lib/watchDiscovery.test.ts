import { describe, expect, it } from "vitest";
import type { Watch } from "@/types";
import {
  buildPopularBrands,
  buildWatchDirectoryStats,
  rankSimilarWatches
} from "@/lib/watchDiscovery";

function watch(overrides: Partial<Watch> = {}): Watch {
  const id = overrides.id ?? 1;
  return {
    id,
    brand: overrides.brand ?? "Omega",
    model: overrides.model ?? "Speedmaster Moonwatch",
    canonicalModel: overrides.canonicalModel ?? null,
    modelGroup: overrides.modelGroup ?? null,
    variant: overrides.variant ?? null,
    reference: overrides.reference ?? `REF-${id}`,
    brandSlug: overrides.brandSlug ?? "omega",
    modelSlug: overrides.modelSlug ?? "speedmaster-moonwatch",
    referenceSlug: overrides.referenceSlug ?? `ref-${id}`,
    lugToLugMm: overrides.lugToLugMm ?? 47.5,
    caseMm: overrides.caseMm ?? 42,
    thicknessMm: overrides.thicknessMm ?? 13.2,
    lugWidthMm: overrides.lugWidthMm ?? 20,
    status: overrides.status ?? "approved",
    updatedAt: overrides.updatedAt ?? "2026-08-12T00:00:00.000Z"
  };
}

describe("watch directory discovery", () => {
  it("summarizes popular brands and dimension collections", () => {
    const watches = [
      watch({ id: 1, lugToLugMm: 41, thicknessMm: 9.5 }),
      watch({ id: 2, model: "Seamaster", modelSlug: "seamaster", lugToLugMm: 44, thicknessMm: 11 }),
      watch({
        id: 3,
        brand: "Tissot",
        brandSlug: "tissot",
        model: "PRX",
        modelSlug: "prx",
        lugToLugMm: 46,
        thicknessMm: 10
      })
    ];

    expect(buildPopularBrands(watches)).toEqual([
      { brand: "Omega", brandSlug: "omega", watchCount: 2 },
      { brand: "Tissot", brandSlug: "tissot", watchCount: 1 }
    ]);
    expect(buildWatchDirectoryStats(watches)).toEqual({
      totalRecords: 3,
      brandCount: 2,
      lugToLugUnder42: 1,
      lugToLugUnder44: 2,
      lugToLugUnder46: 3,
      thicknessUnder10: 2
    });
  });

  it("ranks nearby dimensions and excludes the current model family", () => {
    const target = watch({ id: 1, modelGroup: "omega-speedmaster", lugToLugMm: 47.5, caseMm: 42 });
    const sameFamily = watch({
      id: 2,
      modelGroup: "omega-speedmaster",
      reference: "REF-2",
      referenceSlug: "ref-2",
      lugToLugMm: 47.6
    });
    const closest = watch({
      id: 3,
      brand: "Tudor",
      brandSlug: "tudor",
      model: "Black Bay",
      modelSlug: "black-bay",
      lugToLugMm: 47.6,
      caseMm: 41
    });
    const farther = watch({
      id: 4,
      brand: "Longines",
      brandSlug: "longines",
      model: "Spirit",
      modelSlug: "spirit",
      lugToLugMm: 50,
      caseMm: 42
    });

    const similar = rankSimilarWatches([sameFamily, farther, closest], target, 3);

    expect(similar.map((candidate) => candidate.id)).toEqual([3, 4]);
  });
});

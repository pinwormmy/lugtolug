import { describe, expect, it } from "vitest";
import type { Watch } from "@/types";
import { filterGuideWatches, uniqueByModel } from "@/lib/guideList";

function watch(id: number, model: string, lugToLugMm: number, extra: Partial<Watch> = {}): Watch {
  return {
    id,
    brand: "Omega",
    brandSlug: "omega",
    model,
    canonicalModel: null,
    modelGroup: null,
    variant: null,
    reference: `ref-${id}`,
    modelSlug: model.toLowerCase().replace(/\s+/g, "-"),
    referenceSlug: `ref-${id}`,
    lugToLugMm,
    caseMm: 40,
    thicknessMm: 12,
    lugWidthMm: 20,
    status: "approved",
    updatedAt: "2026-01-01",
    ...extra
  };
}

const catalog = [
  watch(1, "Seamaster Diver 300M", 47.7),
  watch(2, "Speedmaster 38", 45),
  watch(3, "Speedmaster 38", 45.2, { modelGroup: "speedmaster-38", reference: "blue" }),
  watch(4, "Constellation 29", 36),
  watch(5, "Planet Ocean 45", 54),
  watch(6, "Explorer 36", 44, { brand: "Rolex", brandSlug: "rolex" })
];

describe("filterGuideWatches", () => {
  it("keeps the band, ranks by sweet spot, and collapses model families", () => {
    const result = filterGuideWatches(catalog, { minMm: 43.3, maxMm: 52, sweetSpotMm: 46.2, sort: "sweet-spot" });

    expect(result.map((entry) => entry.id)).toEqual([3, 1, 6]);
  });

  it("narrows by genre and free-text query", () => {
    expect(filterGuideWatches(catalog, { minMm: 40, maxMm: 60, genreSlug: "dive-watches", sort: "sweet-spot" }).map((w) => w.id)).toEqual([1, 5]);
    expect(filterGuideWatches(catalog, { minMm: 40, maxMm: 60, query: "rolex", sort: "sweet-spot" }).map((w) => w.id)).toEqual([6]);
    expect(filterGuideWatches(catalog, { query: "nothing here", sort: "sweet-spot" })).toEqual([]);
  });

  it("sorts newest first when asked", () => {
    expect(filterGuideWatches(catalog, { maxMm: 44, sort: "newest" }).map((w) => w.id)).toEqual([6, 4]);
  });
});

describe("uniqueByModel", () => {
  it("groups by model group when present and honours the limit", () => {
    expect(uniqueByModel(catalog, 3).map((entry) => entry.id)).toEqual([1, 2, 4]);
  });
});

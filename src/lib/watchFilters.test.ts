import { describe, expect, it } from "vitest";
import type { WatchWithSources } from "@/types";
import {
  createEmptyDimensionFilters,
  filterWatchesByDimensions,
  hasActiveDimensionFilters,
  watchMatchesDimensionFilters
} from "@/lib/watchFilters";

function watch(overrides: Partial<WatchWithSources>): WatchWithSources {
  return {
    id: overrides.id ?? 1,
    brand: overrides.brand ?? "Omega",
    model: overrides.model ?? "Speedmaster Moonwatch Professional",
    reference: overrides.reference ?? "310.30.42.50.01.001",
    brandSlug: overrides.brandSlug ?? "omega",
    modelSlug: overrides.modelSlug ?? "speedmaster-moonwatch-professional",
    referenceSlug: overrides.referenceSlug ?? "310-30-42-50-01-001",
    lugToLugMm: overrides.lugToLugMm ?? 47.5,
    caseMm: overrides.caseMm ?? 42,
    thicknessMm: overrides.thicknessMm ?? 13.2,
    lugWidthMm: overrides.lugWidthMm === undefined ? 20 : overrides.lugWidthMm,
    status: overrides.status ?? "approved",
    updatedAt: overrides.updatedAt ?? "2026-05-31T00:00:00.000Z",
    sources: overrides.sources ?? []
  };
}

describe("watch dimension filters", () => {
  it("starts empty", () => {
    expect(hasActiveDimensionFilters(createEmptyDimensionFilters())).toBe(false);
  });

  it("matches watches within the configured range", () => {
    const filters = createEmptyDimensionFilters();
    filters.lugToLugMm.min = "47";
    filters.lugToLugMm.max = "48";

    expect(watchMatchesDimensionFilters(watch({ lugToLugMm: 47.5 }), filters)).toBe(true);
    expect(watchMatchesDimensionFilters(watch({ lugToLugMm: 46.9 }), filters)).toBe(false);
  });

  it("supports single-sided bounds", () => {
    const minOnly = createEmptyDimensionFilters();
    minOnly.caseMm.min = "40";

    const maxOnly = createEmptyDimensionFilters();
    maxOnly.thicknessMm.max = "13";

    expect(watchMatchesDimensionFilters(watch({ caseMm: 40.5 }), minOnly)).toBe(true);
    expect(watchMatchesDimensionFilters(watch({ caseMm: 39.5 }), minOnly)).toBe(false);
    expect(watchMatchesDimensionFilters(watch({ thicknessMm: 12.9 }), maxOnly)).toBe(true);
    expect(watchMatchesDimensionFilters(watch({ thicknessMm: 13.1 }), maxOnly)).toBe(false);
  });

  it("excludes null dimensions when a relevant filter is active", () => {
    const filters = createEmptyDimensionFilters();
    filters.lugWidthMm.min = "20";

    expect(watchMatchesDimensionFilters(watch({ lugWidthMm: null }), filters)).toBe(false);
  });

  it("filters a list of watches", () => {
    const filters = createEmptyDimensionFilters();
    filters.lugToLugMm.max = "46";

    const results = filterWatchesByDimensions(
      [
        watch({ id: 1, lugToLugMm: 45 }),
        watch({ id: 2, lugToLugMm: 47 })
      ],
      filters
    );

    expect(results.map((item) => item.id)).toEqual([1]);
  });
});

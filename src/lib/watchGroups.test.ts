import { describe, expect, it } from "vitest";
import type { WatchWithSources } from "@/types";
import { groupWatchesForDisplay, shouldUseCompactReferenceSearch } from "@/lib/watchGroups";

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
    lugWidthMm: overrides.lugWidthMm ?? 20,
    confidence: overrides.confidence ?? "high",
    status: overrides.status ?? "approved",
    updatedAt: overrides.updatedAt ?? "2026-05-31T00:00:00.000Z",
    sources: overrides.sources ?? []
  };
}

describe("watch display groups", () => {
  it("groups watches with the same brand, model, and dimensions", () => {
    const groups = groupWatchesForDisplay([
      watch({ id: 1, reference: "310.30.42.50.01.001" }),
      watch({ id: 2, reference: "310.32.42.50.04.001", referenceSlug: "310-32-42-50-04-001" })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].variantCount).toBe(2);
    expect(groups[0].variantReferences).toEqual(["310.30.42.50.01.001", "310.32.42.50.04.001"]);
  });

  it("keeps watches with different dimensions in separate groups", () => {
    const groups = groupWatchesForDisplay([
      watch({ id: 1, thicknessMm: 13.2 }),
      watch({ id: 2, reference: "310.30.42.50.01.004", referenceSlug: "310-30-42-50-01-004", thicknessMm: 13.5 })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.variantCount)).toEqual([1, 1]);
  });

  it("uses the matching reference as the representative for reference searches", () => {
    const groups = groupWatchesForDisplay(
      [
        watch({ id: 1, reference: "310.30.42.50.01.001" }),
        watch({ id: 2, reference: "310.32.42.50.04.001", referenceSlug: "310-32-42-50-04-001" })
      ],
      "310.32.42"
    );

    expect(groups[0].id).toBe(2);
    expect(groups[0].reference).toBe("310.32.42.50.04.001");
  });

  it("supports compact reference searches without separators", () => {
    const groups = groupWatchesForDisplay(
      [
        watch({ id: 1, reference: "310.30.42.50.01.001" }),
        watch({ id: 2, reference: "310.32.42.50.04.001", referenceSlug: "310-32-42-50-04-001" })
      ],
      "3103242"
    );

    expect(groups[0].id).toBe(2);
    expect(groups[0].groupSearchText).toContain("31032425004001");
    expect(groups[0].groupCompactReferenceSearchText).toContain("31032425004001");
  });

  it("uses compact reference search only for reference-like queries", () => {
    expect(shouldUseCompactReferenceSearch("3103042")).toBe(true);
    expect(shouldUseCompactReferenceSearch("h704")).toBe(true);
    expect(shouldUseCompactReferenceSearch("hamilton")).toBe(false);
    expect(shouldUseCompactReferenceSearch("h")).toBe(false);
  });

  it("includes dimensions in the shared search text", () => {
    const groups = groupWatchesForDisplay([watch({ id: 1, lugToLugMm: 47.5, caseMm: 42 })]);

    expect(groups[0].groupSearchText).toContain("lug to lug 47 5");
    expect(groups[0].groupSearchText).toContain("case 42");
  });

  it("handles null dimensions as part of the grouping key", () => {
    const groups = groupWatchesForDisplay([
      watch({ id: 1, lugWidthMm: null }),
      watch({ id: 2, reference: "428.17.26.60.04.004", referenceSlug: "428-17-26-60-04-004", lugWidthMm: null }),
      watch({ id: 3, reference: "428.17.26.60.04.005", referenceSlug: "428-17-26-60-04-005", lugWidthMm: 13 })
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].variantCount).toBe(2);
    expect(groups[1].variantCount).toBe(1);
  });
});

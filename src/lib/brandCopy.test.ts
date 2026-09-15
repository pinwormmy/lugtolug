import { describe, expect, it } from "vitest";
import type { Watch } from "@/types";
import { describeBrand, summarizeBrand } from "@/lib/brandCopy";

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

describe("brand copy", () => {
  it("summarizes counts, ranges and families", () => {
    const summary = summarizeBrand([
      watch(1, "Speedmaster", 47.5, { canonicalModel: "Speedmaster", caseMm: 42, thicknessMm: 13.2 }),
      watch(2, "Speedmaster", 47.5, { canonicalModel: "Speedmaster", caseMm: 42, thicknessMm: 13.2 }),
      watch(3, "Seamaster", 49.9, { caseMm: 42, thicknessMm: null }),
      watch(4, "Constellation 29", 36, { caseMm: 29, thicknessMm: 9 })
    ])!;

    expect(summary.count).toBe(4);
    expect(summary.familyCount).toBe(3);
    expect(summary.families[0]).toEqual({ name: "Speedmaster", count: 2 });
    expect(summary.lugToLugMinMm).toBe(36);
    expect(summary.lugToLugMaxMm).toBe(49.9);
    expect(summary.lugToLugMedianMm).toBe(47.5);
    expect(summary.caseMinMm).toBe(29);
    expect(summary.thicknessMaxMm).toBe(13.2);
    expect(summary.balancedOnMediumWristShare).toBeCloseTo(0.75);

    const [first, fit, families] = describeBrand(summary);
    expect(first).toBe(
      "Omega has 4 watches in the database across 3 model families. Lug-to-lug runs from 36 mm to 49.9 mm, with a median of 47.5 mm, alongside case diameters of 29 mm to 42 mm and thickness of 9 mm to 13.2 mm."
    );
    expect(fit).toBe("75% of them sit in the balanced range on a 6.5-inch wrist.");
    expect(families).toBe("The most documented family is Speedmaster (2).");
  });

  it("keeps a single record readable and returns null for no records", () => {
    expect(summarizeBrand([])).toBeNull();
    const summary = summarizeBrand([watch(1, "Speedmaster", 47.5, { caseMm: null, thicknessMm: null })])!;
    expect(describeBrand(summary)).toEqual(["Omega has 1 watch in the database. It measures 47.5 mm lug-to-lug."]);
  });
});

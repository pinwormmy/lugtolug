import { describe, expect, it } from "vitest";
import {
  buildCompareHref,
  computeCompareScene,
  describeCompareFit,
  estimateCaseMm,
  parseCompareKeys,
  parseWristFlatWidth
} from "@/lib/wristCompare";

const explorer = { brandSlug: "rolex", modelSlug: "explorer-36", referenceSlug: "124270" };
const speedmaster = { brandSlug: "omega", modelSlug: "speedmaster-professional-moonwatch", referenceSlug: "310-30-42-50-01-002" };

describe("compare URL", () => {
  it("round-trips watch keys and the wrist width", () => {
    const href = buildCompareHref([explorer, speedmaster], 57.75);
    const params = new URLSearchParams(href.split("?")[1]);

    expect(href.startsWith("/compare?")).toBe(true);
    expect(parseCompareKeys(params)).toEqual([explorer, speedmaster]);
    expect(parseWristFlatWidth(params.get("wrist"))).toBe(57.8);
  });

  it("drops malformed, duplicate, and surplus keys", () => {
    const params = new URLSearchParams();
    params.append("w", "rolex/explorer-36/124270");
    params.append("w", "rolex/explorer-36/124270");
    params.append("w", "not a key");
    params.append("w", "../etc/passwd");
    params.append("w", "a/b/c");
    params.append("w", "d/e/f");
    params.append("w", "g/h/i");

    expect(parseCompareKeys(params).map((key) => key.brandSlug)).toEqual(["rolex", "a", "d"]);
  });

  it("ignores wrist widths outside a plausible range", () => {
    expect(parseWristFlatWidth("12")).toBeNull();
    expect(parseWristFlatWidth("abc")).toBeNull();
    expect(parseWristFlatWidth("")).toBeNull();
    expect(buildCompareHref([], 500)).toBe("/compare");
  });
});

describe("compare scene", () => {
  it("shares one scale wide enough for the wrist and the widest watch", () => {
    const scene = computeCompareScene(
      [
        { lugToLugMm: 44.5, caseMm: 36, thicknessMm: 11.5 },
        { lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.18 }
      ],
      58
    );

    expect(scene.viewWidthMm).toBe(74);
    expect(scene.viewHeightMm).toBe(62);
    expect(scene.profileHeightMm).toBe(23.2);
  });

  it("estimates a missing case diameter from the span", () => {
    expect(estimateCaseMm({ lugToLugMm: 50, caseMm: null })).toBe(42.5);
    expect(computeCompareScene([{ lugToLugMm: 70, caseMm: null, thicknessMm: null }], null).viewWidthMm).toBe(86);
  });

  it("returns the fit verdict for a wrist, or nothing without one", () => {
    expect(describeCompareFit({ lugToLugMm: 47.5 }, 58)?.category).toBe("balanced");
    expect(describeCompareFit({ lugToLugMm: 60 }, 58)?.category).toBe("overhang");
    expect(describeCompareFit({ lugToLugMm: 47.5 }, null)).toBeNull();
  });
});

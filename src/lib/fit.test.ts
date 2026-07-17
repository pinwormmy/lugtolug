import { describe, expect, it } from "vitest";
import {
  FIT_RATIO_STANDARD,
  getFitGuidance,
  getFitScaleMarkerPositionForRatio,
  mmToInches
} from "@/lib/fit";

describe("fit guidance", () => {
  it("returns balanced guidance for a typical 47.5mm watch on a 54.1mm wrist width", () => {
    const result = getFitGuidance(47.5, 54.1);
    expect(result.category).toBe("balanced");
  });

  it("classifies the proposed fit ratio bands at their boundaries", () => {
    const wristFlatWidthMm = 100;
    expect(getFitGuidance(74.9, wristFlatWidthMm).category).toBe("compact");
    expect(getFitGuidance(75, wristFlatWidthMm).category).toBe("balanced");
    expect(getFitGuidance(90, wristFlatWidthMm).category).toBe("balanced");
    expect(getFitGuidance(90.1, wristFlatWidthMm).category).toBe("large");
    expect(getFitGuidance(95, wristFlatWidthMm).category).toBe("large");
    expect(getFitGuidance(95.1, wristFlatWidthMm).category).toBe("borderline");
    expect(getFitGuidance(100, wristFlatWidthMm).category).toBe("borderline");
    expect(getFitGuidance(100.1, wristFlatWidthMm).category).toBe("overhang");
  });

  it("places the fit marker according to the ratio against the standard value", () => {
    expect(FIT_RATIO_STANDARD).toBe(0.8);
    expect(getFitScaleMarkerPositionForRatio(0.7)).toBe(0);
    expect(getFitScaleMarkerPositionForRatio(0.75)).toBe(14.29);
    expect(getFitScaleMarkerPositionForRatio(FIT_RATIO_STANDARD)).toBe(28.57);
    expect(getFitScaleMarkerPositionForRatio(0.9)).toBe(57.14);
    expect(getFitScaleMarkerPositionForRatio(0.95)).toBe(71.43);
    expect(getFitScaleMarkerPositionForRatio(1)).toBe(85.71);
    expect(getFitScaleMarkerPositionForRatio(1.05)).toBe(100);
  });

  it("converts millimeters to inches", () => {
    expect(mmToInches(25.4)).toBe(1);
  });
});

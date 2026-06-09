import { describe, expect, it } from "vitest";
import {
  getFitGuidance,
  getFitScaleMarkerPosition,
  mmToInches
} from "@/lib/fit";

describe("fit guidance", () => {
  it("returns balanced guidance for a typical 47.5mm watch on a 54.1mm wrist width", () => {
    const result = getFitGuidance(47.5, 54.1);
    expect(result.category).toBe("balanced");
  });

  it("treats ratios from 0.8 through 0.9 as balanced", () => {
    const wristFlatWidthMm = 50;
    expect(getFitGuidance(wristFlatWidthMm * 0.79, wristFlatWidthMm).category).toBe("small");
    expect(getFitGuidance(wristFlatWidthMm * 0.8, wristFlatWidthMm).category).toBe("balanced");
    expect(getFitGuidance(wristFlatWidthMm * 0.9, wristFlatWidthMm).category).toBe("balanced");
    expect(getFitGuidance(wristFlatWidthMm * 0.91, wristFlatWidthMm).category).toBe("large");
  });

  it("places the fit marker according to the verdict category", () => {
    expect(getFitScaleMarkerPosition("small")).toBe(16.67);
    expect(getFitScaleMarkerPosition("balanced")).toBe(50);
    expect(getFitScaleMarkerPosition("large")).toBe(83.33);
  });

  it("converts millimeters to inches", () => {
    expect(mmToInches(25.4)).toBe(1);
  });
});

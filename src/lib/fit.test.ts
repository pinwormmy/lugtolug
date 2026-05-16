import { describe, expect, it } from "vitest";
import { estimateWristFlatWidthMm, getFitGuidance, mmToInches } from "@/lib/fit";

describe("fit guidance", () => {
  it("estimates flat wrist width from circumference", () => {
    expect(estimateWristFlatWidthMm(170)).toBeCloseTo(54.11, 2);
  });

  it("returns balanced guidance for a typical 47.5mm watch on 17cm wrist", () => {
    const result = getFitGuidance(47.5, 170);
    expect(result.category).toBe("balanced");
  });

  it("converts millimeters to inches", () => {
    expect(mmToInches(25.4)).toBe(1);
  });
});

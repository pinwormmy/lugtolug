import { describe, expect, it } from "vitest";
import { parseSubmission } from "@/lib/validation";

describe("submission validation", () => {
  it("accepts a complete submission", () => {
    const result = parseSubmission({
      brand: "Rolex",
      model: "Explorer",
      reference: "124270",
      sourceUrl: "https://example.com/source",
      lugToLugMm: "43",
      diameterMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.reference).toBe("124270");
  });

  it("rejects invalid dimensions and URLs", () => {
    const result = parseSubmission({
      brand: "Rolex",
      model: "Explorer",
      reference: "124270",
      sourceUrl: "not-a-url",
      lugToLugMm: "-1",
      diameterMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.sourceUrl).toBeTruthy();
    expect(result.errors.lugToLugMm).toBeTruthy();
  });

  it("rejects overly long text and implausible dimensions", () => {
    const result = parseSubmission({
      brand: "R".repeat(81),
      model: "Explorer",
      reference: "124270",
      sourceUrl: "https://example.com/source",
      lugToLugMm: "10",
      diameterMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.brand).toContain("characters or fewer");
    expect(result.errors.lugToLugMm).toContain("between");
  });
});

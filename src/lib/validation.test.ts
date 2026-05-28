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
      caseMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.reference).toBe("124270");
  });

  it("accepts only watch name and lug-to-lug", () => {
    const result = parseSubmission({
      model: "Explorer",
      lugToLugMm: "43"
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      brand: "",
      model: "Explorer",
      reference: "",
      sourceUrl: "",
      lugToLugMm: 43,
      caseMm: null,
      thicknessMm: null,
      lugWidthMm: null
    });
  });

  it("accepts plain text source data", () => {
    const result = parseSubmission({
      model: "Explorer",
      sourceUrl: "Measured by owner from calipers",
      lugToLugMm: "43"
    });

    expect(result.ok).toBe(true);
    expect(result.payload?.sourceUrl).toBe("Measured by owner from calipers");
  });

  it("accepts correction report metadata", () => {
    const result = parseSubmission({
      submissionType: "correction",
      reportedWatchId: "12",
      reportedWatchPath: "/watches/rolex/explorer/124270",
      model: "Explorer",
      lugToLugMm: "43",
      privateComment: "Correction report: Dimension is wrong"
    });

    expect(result.ok).toBe(true);
    expect(result.payload).toMatchObject({
      submissionType: "correction",
      reportedWatchId: 12,
      reportedWatchPath: "/watches/rolex/explorer/124270"
    });
  });

  it("rejects invalid required dimensions", () => {
    const result = parseSubmission({
      brand: "Rolex",
      model: "Explorer",
      reference: "124270",
      sourceUrl: "not-a-url",
      lugToLugMm: "-1",
      caseMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.sourceUrl).toBeUndefined();
    expect(result.errors.lugToLugMm).toBeTruthy();
  });

  it("validates optional dimensions when provided", () => {
    const result = parseSubmission({
      model: "Explorer",
      lugToLugMm: "43",
      caseMm: "10"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.caseMm).toContain("between");
  });

  it("rejects overly long text and implausible dimensions", () => {
    const result = parseSubmission({
      brand: "R".repeat(81),
      model: "Explorer",
      reference: "124270",
      sourceUrl: "https://example.com/source",
      lugToLugMm: "10",
      caseMm: "36",
      thicknessMm: "11.5",
      lugWidthMm: "19"
    });

    expect(result.ok).toBe(false);
    expect(result.errors.brand).toContain("characters or fewer");
    expect(result.errors.lugToLugMm).toContain("between");
  });
});

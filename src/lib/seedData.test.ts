import { describe, expect, it } from "vitest";
import seed from "../../data/watches.seed.json";

describe("watch seed data integrity", () => {
  it("uses unique IDs", () => {
    const ids = seed.map((watch) => watch.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not repeat the same brand, model, reference, and case size", () => {
    const keys = seed.map((watch) =>
      [watch.brand, watch.model, watch.reference, watch.caseMm]
        .map((value) => String(value).trim().toLowerCase())
        .join("|")
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("requires a positive lug-to-lug value and at least one valid source URL", () => {
    for (const watch of seed) {
      expect(watch).not.toHaveProperty(["confi", "dence"].join(""));
      expect(watch.lugToLugMm).toBeGreaterThan(0);
      expect(watch.sources.length).toBeGreaterThan(0);

      for (const source of watch.sources) {
        expect(() => new URL(source.sourceUrl)).not.toThrow();
      }
    }
  });
});

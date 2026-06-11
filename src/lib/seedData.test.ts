import { describe, expect, it } from "vitest";
import seed from "../../data/watches.seed.json";
import { searchSeedWatches } from "./seed";

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

  it("includes the planned Patek Philippe and Citizen expansion references without duplicates", () => {
    const referencesByBrand = (brand: string) =>
      seed.filter((watch) => watch.brand === brand).map((watch) => watch.reference);

    const patekReferences = referencesByBrand("Patek Philippe");
    const citizenReferences = referencesByBrand("Citizen");

    expect(patekReferences).toHaveLength(20);
    expect(new Set(patekReferences).size).toBe(patekReferences.length);
    expect(patekReferences).toEqual(
      expect.arrayContaining(["5811/1G-001", "5712/1A-001", "5167A-001", "5168G-010", "5821/1A-001"])
    );

    expect(citizenReferences).toHaveLength(23);
    expect(new Set(citizenReferences).size).toBe(citizenReferences.length);
    expect(citizenReferences).toEqual(
      expect.arrayContaining(["NB6021-17E", "NJ0180-80X", "NB6050-51W", "NJ0150-81L", "NJ0150-81Z"])
    );
  });

  it("returns planned expansion records through seed search", () => {
    for (const query of ["5712", "5167", "Promaster", "TSUYOSA", "Series8"]) {
      expect(searchSeedWatches(query).length).toBeGreaterThan(0);
    }
  });
});

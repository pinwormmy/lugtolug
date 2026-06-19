import { describe, expect, it } from "vitest";
import seed from "../../data/watches.seed.json";
import { searchSeedWatches, seedWatches } from "./seed";
import { groupWatchesForDisplay } from "./watchGroups";

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

  it("includes the Grand Seiko expansion references without duplicates", () => {
    const grandSeikoReferences = seed.filter((watch) => watch.brand === "Grand Seiko").map((watch) => watch.reference);

    expect(grandSeikoReferences).toHaveLength(69);
    expect(new Set(grandSeikoReferences).size).toBe(grandSeikoReferences.length);
    expect(grandSeikoReferences).toEqual(
      expect.arrayContaining(["SBGN027", "SBGE285", "SBGW283", "SBGY013", "SLGB005", "SBGH376", "SBGX355"])
    );
  });

  it("returns planned expansion records through seed search", () => {
    for (const query of ["5712", "5167", "Promaster", "TSUYOSA", "Series8", "SBGN027", "SLGB005", "SBGX355"]) {
      expect(searchSeedWatches(query).length).toBeGreaterThan(0);
    }
  });

  it("groups normalized variant-only seed families for display", () => {
    const expectedGroups = [
      ["omega-seamaster-diver-300m-42mm", 6],
      ["omega-speedmaster-moonwatch-professional-42mm", 2],
      ["formex-reef-39-5mm-automatic-cosc-300m", 5],
      ["traska-commuter-36", 3],
      ["zelos-hammerhead-43-field", 7],
      ["mido-multifort-tv-big-date-40mm", 4],
      ["grand-seiko-sport-quartz-gmt-39mm", 2],
      ["grand-seiko-elegance-manual-winding-37-3mm", 5],
      ["grand-seiko-hand-winding-spring-drive-38-5mm", 3],
      ["grand-seiko-evolution-9-spring-drive-5-days-40mm", 3],
      ["grand-seiko-spring-drive-u-f-a-37mm", 4],
      ["grand-seiko-62gs-mechanical-hi-beat-36000-38mm", 3]
    ] as const;

    for (const [modelGroup, variantCount] of expectedGroups) {
      const groups = groupWatchesForDisplay(seedWatches.filter((watch) => watch.modelGroup === modelGroup));

      expect(groups, modelGroup).toHaveLength(1);
      expect(groups[0].variantCount, modelGroup).toBe(variantCount);
    }
  });
});

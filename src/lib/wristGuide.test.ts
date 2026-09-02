import { describe, expect, it } from "vitest";
import type { Watch } from "@/types";
import {
  LUG_TO_LUG_LIMITS,
  WATCH_GENRES,
  WRIST_SIZES,
  buildWristGuide,
  classifyFit,
  getWatchGenre,
  getWristFitBands,
  getWristSize,
  matchesGenre,
  smallestBalancedWrist,
  smallestCompactWrist
} from "@/lib/wristGuide";

function watch(overrides: Partial<Watch> & { lugToLugMm: number; model: string }): Watch {
  return {
    id: overrides.id ?? Math.round(overrides.lugToLugMm * 10),
    brand: "Omega",
    brandSlug: "omega",
    canonicalModel: null,
    modelGroup: null,
    variant: null,
    reference: overrides.model,
    modelSlug: overrides.model.toLowerCase().replace(/\s+/g, "-"),
    referenceSlug: overrides.model.toLowerCase().replace(/\s+/g, "-"),
    caseMm: 40,
    thicknessMm: 12,
    lugWidthMm: 20,
    status: "approved",
    updatedAt: "2026-01-01",
    ...overrides
  };
}

describe("wrist sizes and limits", () => {
  it("exposes slugs that round-trip", () => {
    expect(WRIST_SIZES.map((size) => size.slug)).toEqual(["5-5-inch", "6-inch", "6-5-inch", "7-inch", "7-5-inch", "8-inch"]);
    expect(getWristSize("6-5-inch")?.label).toBe("6.5 inch (16.5 cm)");
    expect(getWristSize("9-inch")).toBeNull();
    expect(LUG_TO_LUG_LIMITS.map((limit) => limit.slug)).toContain("under-44mm");
  });

  it("derives fit bands from the flat-width ratio", () => {
    const bands = getWristFitBands(getWristSize("6-5-inch")!);

    expect(bands.flatWidthMm).toBe(57.8);
    expect(bands.compactMaxMm).toBe(43.3);
    expect(bands.sweetSpotMm).toBe(46.2);
    expect(bands.balancedMaxMm).toBe(52);
    expect(bands.borderlineMaxMm).toBe(57.8);
  });

  it("classifies a span against a wrist", () => {
    const size = getWristSize("6-5-inch")!;

    expect(classifyFit(40, size)).toBe("compact");
    expect(classifyFit(47, size)).toBe("balanced");
    expect(classifyFit(54, size)).toBe("large");
    expect(classifyFit(57, size)).toBe("borderline");
    expect(classifyFit(60, size)).toBe("overhang");
  });

  it("finds the smallest wrist that carries a span", () => {
    expect(smallestBalancedWrist(44)?.slug).toBe("5-5-inch");
    expect(smallestCompactWrist(44)?.slug).toBe("7-inch");
    expect(smallestBalancedWrist(70)).toBeNull();
  });
});

describe("genre matching", () => {
  const dive = getWatchGenre("dive-watches")!;
  const chrono = getWatchGenre("chronographs")!;
  const gmt = getWatchGenre("gmt-watches")!;

  it("matches on model names conservatively", () => {
    expect(matchesGenre(watch({ model: "Submariner Date", lugToLugMm: 48 }), dive)).toBe(true);
    expect(matchesGenre(watch({ model: "Seamaster Aqua Terra 41", lugToLugMm: 48 }), dive)).toBe(false);
    expect(matchesGenre(watch({ model: "Speedmaster Professional", lugToLugMm: 48 }), chrono)).toBe(true);
    expect(matchesGenre(watch({ model: "Carrera Day-Date", lugToLugMm: 48 }), chrono)).toBe(false);
    expect(matchesGenre(watch({ model: "GMT-Master II", lugToLugMm: 48 }), gmt)).toBe(true);
    expect(matchesGenre(watch({ model: "Datejust 36", lugToLugMm: 48 }), gmt)).toBe(false);
  });

  it("lists every genre with a slug", () => {
    expect(WATCH_GENRES.map((genre) => genre.slug)).toEqual(["dive-watches", "chronographs", "gmt-watches"]);
  });
});

describe("wrist guide", () => {
  const catalog = [
    watch({ model: "Seamaster Diver 300M", lugToLugMm: 47.7 }),
    watch({ model: "Speedmaster 38", lugToLugMm: 45 }),
    watch({ model: "Constellation 29", lugToLugMm: 36, brand: "Omega" }),
    watch({ model: "Planet Ocean 45", lugToLugMm: 54 }),
    watch({ model: "Big Pilot 46", lugToLugMm: 60, brand: "IWC", brandSlug: "iwc" }),
    watch({ model: "Explorer 36", lugToLugMm: 44, brand: "Rolex", brandSlug: "rolex" })
  ];

  it("partitions the catalog into fit bands ordered by closeness to the sweet spot", () => {
    const guide = buildWristGuide(catalog, getWristSize("6-5-inch")!);

    expect(guide.counts).toEqual({ compact: 1, balanced: 3, large: 1, borderline: 0, overhang: 1, total: 6 });
    expect(guide.balanced.map((entry) => entry.model)).toEqual(["Speedmaster 38", "Seamaster Diver 300M", "Explorer 36"]);
    expect(guide.compact.map((entry) => entry.model)).toEqual(["Constellation 29"]);
    expect(guide.large.map((entry) => entry.model)).toEqual(["Planet Ocean 45"]);
    expect(guide.topBrands[0]).toEqual({ brand: "Omega", brandSlug: "omega", count: 2 });
    expect(guide.genreCounts.map((entry) => `${entry.genre.slug}:${entry.count}`)).toEqual(["dive-watches:1", "chronographs:1"]);
  });

  it("narrows to a genre and drops the genre navigation", () => {
    const guide = buildWristGuide(catalog, getWristSize("6-5-inch")!, getWatchGenre("dive-watches")!);

    expect(guide.counts.total).toBe(2);
    expect(guide.balanced.map((entry) => entry.model)).toEqual(["Seamaster Diver 300M"]);
    expect(guide.large.map((entry) => entry.model)).toEqual(["Planet Ocean 45"]);
    expect(guide.genreCounts).toEqual([]);
  });
});

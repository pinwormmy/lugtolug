import { describe, expect, it } from "vitest";
import { buildCatalogStats, buildFaqSchema, describeWearability } from "@/lib/watchWearability";

function watch(overrides: Partial<Parameters<typeof describeWearability>[0]> & { lugToLugMm: number }) {
  return {
    brand: "Omega",
    brandSlug: "omega",
    model: "Seamaster",
    canonicalModel: null,
    caseMm: 40,
    thicknessMm: 12,
    lugWidthMm: 20,
    ...overrides
  };
}

// Ten catalog watches with evenly spread lug-to-lug values (40..49) and ratios.
const catalog = buildCatalogStats(
  Array.from({ length: 10 }, (_, index) => ({
    brandSlug: index < 8 ? "omega" : "seiko",
    lugToLugMm: 40 + index,
    caseMm: 36,
    thicknessMm: 10 + index
  }))
);

describe("wearability profile", () => {
  it("places the watch within the catalog span distribution", () => {
    const { profile } = describeWearability(watch({ lugToLugMm: 46 }), catalog);

    expect(profile.catalogSize).toBe(10);
    expect(profile.longerThanShare).toBe(60);
    expect(profile.shorterThanShare).toBe(30);
    expect(profile.brandCount).toBe(8);
    expect(profile.brandLongerThanShare).toBe(75);
  });

  it("classifies lug proportion against catalog quartiles", () => {
    expect(describeWearability(watch({ lugToLugMm: 40, caseMm: 36 }), catalog).profile.lugProportion).toBe("compact");
    expect(describeWearability(watch({ lugToLugMm: 44.5, caseMm: 36 }), catalog).profile.lugProportion).toBe("typical");
    expect(describeWearability(watch({ lugToLugMm: 49, caseMm: 36 }), catalog).profile.lugProportion).toBe("long");
    expect(describeWearability(watch({ lugToLugMm: 49, caseMm: null }), catalog).profile.lugProportion).toBeNull();
  });

  it("derives wrist thresholds from the fit ratio bands", () => {
    const { profile } = describeWearability(watch({ lugToLugMm: 45 }), catalog);

    expect(profile.balancedWristFromMm).toBe(50);
    expect(profile.compactWristFromMm).toBe(60);
    expect(profile.overhangWristBelowMm).toBe(45);
  });

  it("skips brand context for brands with few records", () => {
    const { profile } = describeWearability(watch({ lugToLugMm: 45, brandSlug: "seiko", brand: "Seiko" }), catalog);

    expect(profile.brandLongerThanShare).toBeNull();
  });
});

describe("wearability copy", () => {
  it("writes a headline, paragraphs, and three FAQ entries", () => {
    const { copy } = describeWearability(watch({ lugToLugMm: 49, caseMm: 36 }), catalog);

    expect(copy.headline).toBe("Wears larger than its 36 mm case suggests");
    expect(copy.paragraphs[0]).toContain("49 mm lug-to-lug on a 36 mm case");
    expect(copy.paragraphs[1]).toContain("55 mm (2.17 in)");
    expect(copy.paragraphs).toHaveLength(3);
    expect(copy.faq.map((entry) => entry.question)).toEqual([
      "What is the lug-to-lug of the Omega Seamaster 36mm?",
      "Does the Omega Seamaster 36mm wear big?",
      "What wrist size does the Omega Seamaster 36mm fit?"
    ]);
  });

  it("omits the thickness paragraph when thickness is unknown", () => {
    const { copy } = describeWearability(watch({ lugToLugMm: 45, thicknessMm: null }), catalog);

    expect(copy.paragraphs).toHaveLength(2);
    expect(copy.faq[0].answer).not.toContain("thickness");
  });

  it("builds FAQPage structured data", () => {
    const { copy } = describeWearability(watch({ lugToLugMm: 45 }), catalog);
    const schema = buildFaqSchema(copy.faq) as { "@type": string; mainEntity: unknown[] };

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(3);
  });
});

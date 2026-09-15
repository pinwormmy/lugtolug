import { describe, expect, it } from "vitest";
import {
  BRAND_PRIORITY_TIERS,
  ESTABLISHED_BRAND_RANK,
  MAJOR_BRAND_RANK,
  OTHER_BRAND_RANK,
  compareBrandOrder,
  compareBrandPriority,
  getBrandOrder,
  getBrandRank,
  pickWithBrandCap,
  prioritizeMajorBrands
} from "@/lib/brandPriority";
import { seedWatches } from "@/lib/seed";

describe("brand priority", () => {
  it("ranks major brands ahead of established and unlisted ones", () => {
    expect(getBrandRank("rolex")).toBe(MAJOR_BRAND_RANK);
    expect(getBrandRank("christopher-ward")).toBe(ESTABLISHED_BRAND_RANK);
    expect(getBrandRank("some-new-microbrand")).toBe(OTHER_BRAND_RANK);
  });

  it("lets collaborations inherit the parent brand's tier", () => {
    expect(getBrandRank("omega-x-swatch")).toBe(MAJOR_BRAND_RANK);
    expect(getBrandRank("nivada-grenchen-x-worn-and-wound")).toBe(ESTABLISHED_BRAND_RANK);
    expect(getBrandRank("unknown-x-partner")).toBe(OTHER_BRAND_RANK);
  });

  it("orders brand directories by the curated list", () => {
    expect(getBrandOrder("rolex")).toBe(0);
    expect(getBrandOrder("omega")).toBe(1);
    expect(getBrandOrder("omega-x-swatch")).toBe(Number.POSITIVE_INFINITY);
    expect(getBrandOrder("unlisted")).toBe(Number.POSITIVE_INFINITY);
    const brands = [{ brandSlug: "unlisted" }, { brandSlug: "doxa" }, { brandSlug: "omega" }, { brandSlug: "also-unlisted" }, { brandSlug: "rolex" }];
    expect([...brands].sort(compareBrandOrder).map((brand) => brand.brandSlug)).toEqual(["rolex", "omega", "doxa", "unlisted", "also-unlisted"]);
  });

  it("reorders stably inside each tier", () => {
    const items = [
      { id: 1, brandSlug: "doxa" },
      { id: 2, brandSlug: "zzz-micro" },
      { id: 3, brandSlug: "seiko" },
      { id: 4, brandSlug: "baltic" },
      { id: 5, brandSlug: "rolex" }
    ];
    expect(prioritizeMajorBrands(items).map((item) => item.id)).toEqual([3, 5, 1, 4, 2]);
    expect([...items].sort(compareBrandPriority).map((item) => item.id)).toEqual([3, 5, 1, 4, 2]);
  });

  it("only lists brand slugs that exist in the seed catalog", () => {
    const seedSlugs = new Set(seedWatches.map((watch) => watch.brandSlug));
    const listed = [...BRAND_PRIORITY_TIERS.tier1, ...BRAND_PRIORITY_TIERS.tier2];
    const missing = listed.filter((slug) => !seedSlugs.has(slug));
    expect(missing).toEqual([]);
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("pickWithBrandCap", () => {
  const items = [
    ...[1, 2, 3, 4, 5].map((id) => ({ id, brandSlug: "grand-seiko" })),
    { id: 6, brandSlug: "baltic" },
    { id: 7, brandSlug: "rolex" },
    { id: 8, brandSlug: "zzz-micro" }
  ];

  it("caps each brand and keeps priority order", () => {
    expect(pickWithBrandCap(items, 5, 2).map((item) => item.id)).toEqual([1, 2, 7, 6, 8]);
  });

  it("tops the list up with capped items when there are not enough brands", () => {
    expect(pickWithBrandCap(items, 7, 2).map((item) => item.id)).toEqual([1, 2, 7, 6, 8, 3, 4]);
    expect(pickWithBrandCap(items, 20, 1).map((item) => item.id)).toEqual([1, 7, 6, 8, 2, 3, 4, 5]);
  });
});

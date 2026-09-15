import { describe, expect, it } from "vitest";
import { getWatchSlugs, legacySlugify, normalizeSearch, normalizeSearchWithAliases, slugify } from "@/lib/slug";

describe("slug helpers", () => {
  it("creates stable URL slugs", () => {
    expect(slugify("Speedmaster Professional Moonwatch")).toBe("speedmaster-professional-moonwatch");
    expect(slugify("310.30.42.50.01.002")).toBe("310-30-42-50-01-002");
  });

  it("transliterates accented letters instead of dropping them", () => {
    expect(slugify("A. Lange & Söhne")).toBe("a-lange-and-sohne");
    expect(slugify("Glashütte Original")).toBe("glashutte-original");
    expect(slugify("Hermès")).toBe("hermes");
    expect(slugify("Universal Genève")).toBe("universal-geneve");
    expect(slugify("Grøne")).toBe("grone");
    expect(slugify("Habring²")).toBe("habring2");
    expect(slugify("Seiko 5 Sports × Worn & Wound")).toBe("seiko-5-sports-x-worn-and-wound");
    expect(slugify("Prospex Diver’s")).toBe("prospex-diver-s");
  });

  it("keeps the legacy slug rule for redirects", () => {
    expect(legacySlugify("Glashütte Original")).toBe("glash-tte-original");
    expect(legacySlugify("Speedmaster Professional Moonwatch")).toBe("speedmaster-professional-moonwatch");
  });

  it("normalizes search text", () => {
    expect(normalizeSearch("Tudor Black-Bay 58 / M79030N-0001")).toBe("tudor black bay 58 m79030n 0001");
  });

  it("adds German transliteration aliases to search text", () => {
    expect(normalizeSearchWithAliases("Mühle Glashütte")).toBe("muhle glashutte muehle glashuette");
  });

  it("shares stable watch route slugs across seed and database records", () => {
    expect(getWatchSlugs({ brand: "Mido", model: "문페이즈", reference: "M123.45" })).toEqual({
      brandSlug: "mido",
      modelSlug: "m123-45",
      referenceSlug: "m123-45"
    });
    expect(getWatchSlugs({ brand: "", model: "문페이즈", reference: "" })).toEqual({
      brandSlug: "unknown-brand",
      modelSlug: "watch",
      referenceSlug: "no-reference"
    });
  });
});

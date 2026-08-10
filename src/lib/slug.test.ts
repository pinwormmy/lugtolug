import { describe, expect, it } from "vitest";
import { getWatchSlugs, normalizeSearch, normalizeSearchWithAliases, slugify } from "@/lib/slug";

describe("slug helpers", () => {
  it("creates stable URL slugs", () => {
    expect(slugify("Speedmaster Professional Moonwatch")).toBe("speedmaster-professional-moonwatch");
    expect(slugify("310.30.42.50.01.002")).toBe("310-30-42-50-01-002");
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

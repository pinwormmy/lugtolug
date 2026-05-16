import { describe, expect, it } from "vitest";
import { normalizeSearch, slugify } from "@/lib/slug";

describe("slug helpers", () => {
  it("creates stable URL slugs", () => {
    expect(slugify("Speedmaster Professional Moonwatch")).toBe("speedmaster-professional-moonwatch");
    expect(slugify("310.30.42.50.01.002")).toBe("310-30-42-50-01-002");
  });

  it("normalizes search text", () => {
    expect(normalizeSearch("Tudor Black-Bay 58 / M79030N-0001")).toBe("tudor black bay 58 m79030n 0001");
  });
});

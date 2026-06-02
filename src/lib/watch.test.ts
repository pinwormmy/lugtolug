import { describe, expect, it } from "vitest";
import { getSearchTokens, searchTextMatchesQuery, watchMatchesSearchQuery } from "@/lib/watch";

describe("watch search matching", () => {
  it("requires a non-empty normalized query", () => {
    expect(getSearchTokens("   ")).toEqual([]);
    expect(searchTextMatchesQuery("hamilton ardmore h11221814", "   ")).toBe(false);
  });

  it("matches all query tokens regardless of order", () => {
    expect(searchTextMatchesQuery("seiko presage cocktail time srpb43", "presage seiko")).toBe(true);
    expect(searchTextMatchesQuery("seiko presage cocktail time srpb43", "seiko diver")).toBe(false);
  });

  it("checks the watch display fields so unrelated watches are excluded", () => {
    expect(
      watchMatchesSearchQuery(
        {
          brand: "Hamilton",
          model: "American Classic Ardmore",
          reference: "H11221814"
        },
        "seiko"
      )
    ).toBe(false);
  });
});

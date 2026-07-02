import { describe, expect, it } from "vitest";
import {
  getSearchTokens,
  getWatchDisplayModel,
  getWatchDisplayName,
  searchTextMatchesQuery,
  watchMatchesSearchQuery
} from "@/lib/watch";

describe("watch display name", () => {
  it("appends the case size when the name does not mention it", () => {
    expect(getWatchDisplayModel({ model: "Submariner Date", canonicalModel: null, caseMm: 41 })).toBe(
      "Submariner Date 41mm"
    );
    expect(
      getWatchDisplayName({ brand: "Rolex", model: "Submariner Date", canonicalModel: null, caseMm: 41 })
    ).toBe("Rolex Submariner Date 41mm");
  });

  it("keeps names that already mention the case size", () => {
    expect(
      getWatchDisplayModel({ model: "Speedmaster Moonwatch Professional 42mm", canonicalModel: null, caseMm: 42 })
    ).toBe("Speedmaster Moonwatch Professional 42mm");
    expect(getWatchDisplayModel({ model: "Land-Dweller 36", canonicalModel: null, caseMm: 36 })).toBe(
      "Land-Dweller 36"
    );
    expect(
      getWatchDisplayModel({
        model: "Seamaster Aqua Terra 150M Co-Axial Master Chronometer 41 mm",
        canonicalModel: null,
        caseMm: 41
      })
    ).toBe("Seamaster Aqua Terra 150M Co-Axial Master Chronometer 41 mm");
  });

  it("does not mistake other numbers in the name for the case size", () => {
    expect(getWatchDisplayModel({ model: "Radiomir 1940 3 Days", canonicalModel: null, caseMm: 40 })).toBe(
      "Radiomir 1940 3 Days 40mm"
    );
    expect(getWatchDisplayModel({ model: "Reef 40.5 Automatic", canonicalModel: null, caseMm: 40 })).toBe(
      "Reef 40.5 Automatic 40mm"
    );
    expect(getWatchDisplayModel({ model: "Seamaster Diver 300M", canonicalModel: null, caseMm: 42 })).toBe(
      "Seamaster Diver 300M 42mm"
    );
  });

  it("handles fractional case sizes and missing values", () => {
    expect(getWatchDisplayModel({ model: "Hand-winding Spring Drive", canonicalModel: null, caseMm: 38.5 })).toBe(
      "Hand-winding Spring Drive 38.5mm"
    );
    expect(
      getWatchDisplayModel({
        model: "Speedmaster Racing Co-Axial Master Chronometer Chronograph 44 25 mm",
        canonicalModel: null,
        caseMm: 44.25
      })
    ).toBe("Speedmaster Racing Co-Axial Master Chronometer Chronograph 44 25 mm");
    expect(getWatchDisplayModel({ model: "Parade", canonicalModel: null, caseMm: null })).toBe("Parade");
  });

  it("prefers the canonical model when present", () => {
    expect(
      getWatchDisplayModel({ model: "Elegance Hand-winding Iwao Blue", canonicalModel: "Hand-winding Spring Drive 38.5mm", caseMm: 38.5 })
    ).toBe("Hand-winding Spring Drive 38.5mm");
    expect(
      getWatchDisplayModel({ model: "Bel Canto C1 Bel Canto", canonicalModel: "Bel Canto C1", caseMm: 41 })
    ).toBe("Bel Canto C1 41mm");
  });
});

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

  it("matches German brand names with common English transliterations", () => {
    const watch = {
      brand: "Mühle Glashütte",
      model: "29er Big",
      reference: "M1-25-33-LB"
    };

    expect(watchMatchesSearchQuery(watch, "muhle glashutte")).toBe(true);
    expect(watchMatchesSearchQuery(watch, "muehle glashuette")).toBe(true);
  });
});

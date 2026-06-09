import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SearchApp from "@/components/SearchApp";
import WatchSearchResults from "@/components/search/WatchSearchResults";
import { buildSearchUrl, readSearchState } from "@/lib/searchState";
import { createEmptyDimensionFilters } from "@/lib/watchFilters";

describe("SearchApp feature contracts", () => {
  it("keeps dimension filters available below the search field", () => {
    const markup = renderToStaticMarkup(<SearchApp initialQuery="omega" watches={[]} />);

    expect(markup).toContain("Search watches or references");
    expect(markup).toContain("aria-controls=\"search-filters-panel\"");
    expect(markup).toContain(">Filters<");
    expect(markup).toContain('value="omega"');
  });

  it("lists recently added as the first sort option", () => {
    const markup = renderToStaticMarkup(
      <WatchSearchResults filteredCount={0} isPending={false} onSortChange={() => undefined} results={[]} sort="recent" />
    );

    expect(markup).toContain('<option value="recent" selected="">Recently added</option>');
  });

  it("keeps the search query in the URL when updating", () => {
    expect(
      buildSearchUrl(
        { pathname: "/", search: "", hash: "" },
        {
          query: "omega",
          sort: "recent",
          dimensionFilters: createEmptyDimensionFilters()
        }
      )
    ).toBe("/?q=omega");

    expect(
      buildSearchUrl(
        { pathname: "/watches", search: "?page=2", hash: "#top" },
        {
          query: "",
          sort: "lug-desc",
          dimensionFilters: createEmptyDimensionFilters()
        }
      )
    ).toBe("/watches?page=2&sort=lug-desc#top");
  });

  it("restores search state from the URL", () => {
    const state = readSearchState(
      new URLSearchParams(
        "q=omega&sort=lug-asc&lugToLugMmMin=40&lugToLugMmMax=45&caseMmMin=36&caseMmMax="
      )
    );

    expect(state.query).toBe("omega");
    expect(state.sort).toBe("lug-asc");
    expect(state.dimensionFilters.lugToLugMm.min).toBe("40");
    expect(state.dimensionFilters.lugToLugMm.max).toBe("45");
    expect(state.dimensionFilters.caseMm.min).toBe("36");
    expect(state.dimensionFilters.caseMm.max).toBe("");
  });
});

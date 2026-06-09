import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SearchApp from "@/components/SearchApp";
import WatchSearchResults from "@/components/search/WatchSearchResults";

describe("SearchApp feature contracts", () => {
  it("keeps dimension filters available below the search field", () => {
    const markup = renderToStaticMarkup(<SearchApp watches={[]} />);

    expect(markup).toContain("Search watches or references");
    expect(markup).toContain("aria-controls=\"search-filters-panel\"");
    expect(markup).toContain(">Filters<");
  });

  it("lists recently added as the first sort option", () => {
    const markup = renderToStaticMarkup(
      <WatchSearchResults filteredCount={0} isPending={false} onSortChange={() => undefined} results={[]} sort="recent" />
    );

    expect(markup).toContain('<option value="recent" selected="">Recently added</option>');
  });
});

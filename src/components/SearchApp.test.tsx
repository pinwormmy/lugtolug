import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import SearchApp from "@/components/SearchApp";

describe("SearchApp feature contracts", () => {
  it("keeps dimension filters available below the search field", () => {
    const markup = renderToStaticMarkup(<SearchApp watches={[]} />);

    expect(markup).toContain("Search watches or references");
    expect(markup).toContain("aria-controls=\"search-filters-panel\"");
    expect(markup).toContain(">Filters<");
  });
});

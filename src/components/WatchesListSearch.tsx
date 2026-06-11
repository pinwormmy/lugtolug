import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { WatchDisplayGroup } from "@/lib/watchGroups";
import { formatMm, getWatchDisplayName, getWatchHref, searchTextMatchesQuery } from "@/lib/watch";
import { buildSearchUrl, readSearchState } from "@/lib/searchState";

interface Props {
  watches: WatchDisplayGroup[];
  initialQuery?: string;
}

export default function WatchesListSearch({ watches, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;

  const filtered = useMemo(() => {
    if (!hasSearchQuery) return watches;
    return watches.filter((watch) => (
      searchTextMatchesQuery(watch.groupSearchText, deferredQuery)
    ));
  }, [deferredQuery, hasSearchQuery, watches]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentSearchState = readSearchState(new URLSearchParams(window.location.search));
    window.history.replaceState(
      window.history.state,
      "",
      buildSearchUrl(window.location, {
        query,
        sort: currentSearchState.sort,
        dimensionFilters: currentSearchState.dimensionFilters
      })
    );
  }, [query]);

  return (
    <section className="watches-browser" aria-label="Watch database browser">
      <div className="watches-search-bar database-controls">
        <div className="watches-search-main">
          <label>
            <span>Search watches or references</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                aria-label="Search watches by name or reference"
                placeholder="Search watches or references"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
        </div>
      </div>

      <div className="watches-page-head">
        <div>
          <h1 className="page-title">Watch database</h1>
          <p className="lede watches-lede">Approved records with watch names and references. Search to find matching references.</p>
        </div>
        <span>{filtered.length.toLocaleString()} / {watches.length.toLocaleString()} records</span>
      </div>

      <div className="watch-list">
        {filtered.map((watch) => (
          <a className="watch-row watch-row--summary" href={getWatchHref(watch)} key={watch.id}>
            <div className="watch-summary">
              <div className="watch-summary-name">
                <strong>{getWatchDisplayName(watch)}</strong>
                {watch.variantCount > 1 && <span>{watch.variantCount} references</span>}
              </div>
              <strong className="watch-summary-size">{formatMm(watch.lugToLugMm)}</strong>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="empty-state">No matching watches yet.</p>
      )}
    </section>
  );
}

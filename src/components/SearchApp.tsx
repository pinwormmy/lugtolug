import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { WatchWithSources } from "@/types";
import { formatMm, getWatchHref, searchTextMatchesQuery } from "@/lib/watch";

interface Props {
  watches: WatchWithSources[];
}

type SortKey = "recent" | "name-asc" | "name-desc";

function sortWatches(watches: WatchWithSources[], sort: SortKey): WatchWithSources[] {
  const sorted = [...watches];
  sorted.sort((a, b) => {
    if (sort === "name-asc") {
      return [a.brand, a.model, a.reference].filter(Boolean).join(" ").localeCompare(
        [b.brand, b.model, b.reference].filter(Boolean).join(" ")
      );
    }

    if (sort === "name-desc") {
      return [b.brand, b.model, b.reference].filter(Boolean).join(" ").localeCompare(
        [a.brand, a.model, a.reference].filter(Boolean).join(" ")
      );
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return sorted;
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const isPending = query !== deferredQuery;

  const filtered = useMemo(() => {
    if (!hasSearchQuery) return [];
    const searched = watches.filter((watch) =>
      searchTextMatchesQuery([watch.brand, watch.model, watch.reference].filter(Boolean).join(" "), deferredQuery)
    );
    return sortWatches(searched, sort);
  }, [deferredQuery, hasSearchQuery, sort, watches]);

  const results = filtered.slice(0, 80);

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = hasSearchQuery;
    return () => {
      recentSection.hidden = false;
    };
  }, [hasSearchQuery]);

  return (
    <section className={`database-workbench${hasSearchQuery ? " has-filtered-state" : ""}`} aria-label="Lug to Lug Finder database">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find the watch record you need.</h1>
          <p>Search by brand, model, or reference, then open the full record for the published measurements and sources.</p>
        </div>
        <div className="status-strip" aria-label="Database status">
          <span>{watches.length.toLocaleString()} records</span>
        </div>
      </div>

      <div className="database-controls">
        <div className="search-panel" role="search">
          <label>
            <span>Search watches or references</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInputRef}
                className="input"
                aria-label="Search watches by name or reference"
                placeholder="e.g., Omega Speedmaster or 310.30"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
          <div className="search-panel-actions">
            <button
              className={`button secondary search-filter-toggle${filtersOpen ? " active" : ""}`}
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="search-filters"
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
              Filters
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {hasSearchQuery && (
              <button
                className="button secondary"
                type="button"
                onClick={() => {
                  setQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={16} aria-hidden="true" />
                Clear
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className="search-filters" id="search-filters">
              <label className="sort-control">
                <span>Sort by</span>
                <select className="select compact-select" value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
                  <option value="recent">Recently added</option>
                  <option value="name-asc">Name asc</option>
                  <option value="name-desc">Name desc</option>
                </select>
              </label>
            </div>
          )}
        </div>
      </div>

      {hasSearchQuery && (
        <div className="database-layout">
          <section className="results-panel" aria-busy={isPending}>
            <div className="results-head">
              <strong>{filtered.length.toLocaleString()} results</strong>
            </div>
            <div className="watch-list search-results-list" aria-label="Watch results">
              {results.map((watch) => {
                return (
                  <a className="watch-row watch-row--summary" href={getWatchHref(watch)} key={watch.id}>
                    <div className="watch-summary">
                      <div className="watch-summary-name">
                        <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                      </div>
                      <strong className="watch-summary-size">{formatMm(watch.lugToLugMm)}</strong>
                    </div>
                  </a>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="empty-state">No matching watches yet. Try a different brand or reference.</p>
            )}
            {filtered.length > results.length && <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>}
          </section>
        </div>
      )}
    </section>
  );
}

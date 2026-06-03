import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { WatchDisplayGroup } from "@/lib/watchGroups";
import { getWatchHref, searchTextMatchesQuery } from "@/lib/watch";

interface Props {
  watches: WatchDisplayGroup[];
}

export default function WatchesListSearch({ watches }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;

  const filtered = useMemo(() => {
    if (!hasSearchQuery) return watches;
    return watches.filter((watch) => (
      searchTextMatchesQuery([watch.brand, watch.model, watch.reference].filter(Boolean).join(" "), deferredQuery)
    ));
  }, [deferredQuery, hasSearchQuery, watches]);

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
                <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                {watch.variantCount > 1 && <span>{watch.variantCount} references</span>}
              </div>
              <span>{watch.reference || "Reference not provided"}</span>
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

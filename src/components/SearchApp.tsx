import { Search } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { formatMm, getWatchHref, WATCH_METRICS } from "@/lib/watch";
import { groupWatchesForDisplay } from "@/lib/watchGroups";

interface Props {
  watches: WatchWithSources[];
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalized = normalizeSearch(deferredQuery);
  const isPending = query !== deferredQuery;
  const results = useMemo(() => {
    if (!normalized) return [];
    return groupWatchesForDisplay(watches, deferredQuery)
      .filter((watch) => watch.groupSearchText.includes(normalized))
      .slice(0, 12);
  }, [deferredQuery, normalized, watches]);

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;

    recentSection.hidden = Boolean(normalized);

    return () => {
      recentSection.hidden = false;
    };
  }, [normalized]);

  return (
    <div className="tool-panel search-panel">
      <form className="search-input-row" role="search" onSubmit={(event) => event.preventDefault()}>
        <input
          className="input"
          aria-label="Search by brand, model, or reference"
          placeholder="Brand, model, or reference"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
        <button className="button" type="submit" aria-label="Search">
          <Search size={18} aria-hidden="true" />
          Search
        </button>
      </form>
      {normalized && (
        <div className="results" aria-busy={isPending}>
          {results.map((watch) => (
            <a
              className="watch-row"
              key={watch.id}
              href={getWatchHref(watch)}
            >
              <div className="watch-name">
                <strong>
                  {[watch.brand, watch.model].filter(Boolean).join(" ")}
                </strong>
                <span>
                  {watch.reference || "Reference not provided"}
                  {watch.variantCount > 1 ? ` · ${watch.variantCount} references` : ""}
                </span>
              </div>
              {WATCH_METRICS.map((metric) => (
                <div className="metric" key={metric.key}>
                  <span>{metric.rowLabel}</span>
                  <strong>{formatMm(watch[metric.key])}</strong>
                </div>
              ))}
            </a>
          ))}
          {results.length === 0 && <p className="small">No matching watches yet. Submit a source and the operator can review it.</p>}
        </div>
      )}
    </div>
  );
}

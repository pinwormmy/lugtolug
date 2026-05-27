import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { formatMm, getWatchHref, getWatchSearchText, WATCH_METRICS } from "@/lib/watch";

interface Props {
  watches: WatchWithSources[];
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const normalized = normalizeSearch(query);
  const results = useMemo(() => {
    if (!normalized) return [];
    return watches.filter((watch) => getWatchSearchText(watch).includes(normalized)).slice(0, 12);
  }, [normalized, watches]);

  return (
    <div className="tool-panel search-panel">
      <form className="search-input-row" role="search" onSubmit={(event) => event.preventDefault()}>
        <input
          className="input"
          aria-label="Search by brand, model, or reference"
          placeholder="Brand, model, or reference"
          value={query}
          onChange={(event) => {
            const value = event.currentTarget.value;
            startTransition(() => setQuery(value));
          }}
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
                  {watch.brand} {watch.model}
                </strong>
                <span>{watch.reference}</span>
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

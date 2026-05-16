import { Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";

interface Props {
  watches: WatchWithSources[];
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const normalized = normalizeSearch(query);
  const results = useMemo(() => {
    if (!normalized) return watches.slice(0, 8);
    return watches
      .filter((watch) => normalizeSearch(`${watch.brand} ${watch.model} ${watch.reference}`).includes(normalized))
      .slice(0, 12);
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
      <div className="results" aria-busy={isPending}>
        {results.map((watch) => (
          <a
            className="watch-row"
            key={watch.id}
            href={`/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`}
          >
            <div className="watch-name">
              <strong>
                {watch.brand} {watch.model}
              </strong>
              <span>{watch.reference}</span>
            </div>
            <div className="metric">
              <span>Lug-to-lug</span>
              <strong>{watch.lugToLugMm} mm</strong>
            </div>
            <div className="metric">
              <span>Diameter</span>
              <strong>{watch.diameterMm} mm</strong>
            </div>
            <div className="metric">
              <span>Thickness</span>
              <strong>{watch.thicknessMm} mm</strong>
            </div>
            <div className="metric">
              <span>Lug width</span>
              <strong>{watch.lugWidthMm} mm</strong>
            </div>
          </a>
        ))}
        {results.length === 0 && <p className="small">No matching watches yet. Submit a source and the operator can review it.</p>}
      </div>
    </div>
  );
}

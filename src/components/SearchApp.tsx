import { ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { formatMm, getWatchHref, WATCH_METRICS } from "@/lib/watch";
import { groupWatchesForDisplay } from "@/lib/watchGroups";
import {
  createEmptyDimensionFilters,
  filterWatchesByDimensions,
  hasActiveDimensionFilters,
  type DimensionKey,
  type DimensionFilters
} from "@/lib/watchFilters";

interface Props {
  watches: WatchWithSources[];
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DimensionFilters>(() => createEmptyDimensionFilters());
  const deferredQuery = useDeferredValue(query);
  const normalized = normalizeSearch(deferredQuery);
  const isPending = query !== deferredQuery;
  const hasActiveFilters = hasActiveDimensionFilters(filters);
  const shouldShowResults = Boolean(normalized || hasActiveFilters);

  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches, deferredQuery), [deferredQuery, watches]);
  const results = useMemo(() => {
    const filtered = filterWatchesByDimensions(groupedWatches, filters);
    return normalized ? filtered.filter((watch) => watch.groupSearchText.includes(normalized)).slice(0, 12) : filtered.slice(0, 12);
  }, [filters, groupedWatches, normalized]);

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;

    recentSection.hidden = shouldShowResults;

    return () => {
      recentSection.hidden = false;
    };
  }, [shouldShowResults]);

  function updateFilter(key: DimensionKey, bound: keyof DimensionFilters[DimensionKey], value: string) {
    setFilters((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [bound]: value
      }
    }));
  }

  function resetFilters() {
    setFilters(createEmptyDimensionFilters());
  }

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
          {hasActiveFilters ? <span className="filter-pill">On</span> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        {hasActiveFilters && (
          <button className="button secondary" type="button" onClick={resetFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
        )}
      </div>
      {filtersOpen && (
        <div className="search-filters" id="search-filters">
          {WATCH_METRICS.map((metric) => (
            <div className="filter-row" key={metric.key}>
              <span className="filter-label">{metric.rowLabel}</span>
              <div className="filter-range">
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="Min"
                  aria-label={`${metric.rowLabel} minimum`}
                  value={filters[metric.key].min}
                  onChange={(event) => updateFilter(metric.key, "min", event.currentTarget.value)}
                />
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="Max"
                  aria-label={`${metric.rowLabel} maximum`}
                  value={filters[metric.key].max}
                  onChange={(event) => updateFilter(metric.key, "max", event.currentTarget.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {shouldShowResults && (
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

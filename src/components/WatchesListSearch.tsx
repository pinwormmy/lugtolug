import { ChevronDown, Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import type { WatchDisplayGroup } from "@/lib/watchGroups";
import { getCompactReferenceSearchText, shouldUseCompactReferenceSearch } from "@/lib/watchGroups";
import { getWatchHref, searchTextMatchesQuery, WATCH_METRICS, formatMm } from "@/lib/watch";
import { normalizeSearch } from "@/lib/slug";
import {
  createEmptyDimensionFilters,
  filterWatchesByDimensions,
  hasActiveDimensionFilters,
  type DimensionFilters,
  type DimensionKey
} from "@/lib/watchFilters";

interface Props {
  watches: WatchDisplayGroup[];
}

export default function WatchesListSearch({ watches }: Props) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<DimensionFilters>(() => createEmptyDimensionFilters());
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const normalized = normalizeSearch(deferredQuery);
  const compactReferenceQuery = getCompactReferenceSearchText(deferredQuery);
  const shouldMatchCompactReference = shouldUseCompactReferenceSearch(compactReferenceQuery);
  const hasActiveFilters = hasActiveDimensionFilters(filters);

  const filtered = useMemo(() => {
    const dimensionFiltered = filterWatchesByDimensions(watches, filters);
    if (!hasSearchQuery) return dimensionFiltered;
    return dimensionFiltered.filter((watch) => (
      (normalized.length > 0 && searchTextMatchesQuery(watch.groupSearchText, deferredQuery)) ||
      (shouldMatchCompactReference && watch.groupCompactReferenceSearchText.includes(compactReferenceQuery))
    ));
  }, [compactReferenceQuery, deferredQuery, filters, hasSearchQuery, normalized, shouldMatchCompactReference, watches]);

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
    setQuery("");
  }

  return (
    <section className="watches-browser" aria-label="Watch database browser">
      <div className="watches-search-bar database-controls">
        <div className="watches-search-main">
          <label>
            <span>Search watches, references, or dimensions</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                aria-label="Search watches by name, reference, or dimensions"
                placeholder="Search watches, references, or dimensions"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
          <button
            className={`button secondary search-filter-toggle${filtersOpen ? " active" : ""}`}
            type="button"
            aria-expanded={filtersOpen}
            aria-controls="watches-search-filters"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            Filters
            {hasActiveFilters ? <span className="filter-pill">On</span> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
          {(hasSearchQuery || hasActiveFilters) && (
            <button className="button secondary watches-reset-button" type="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              Reset
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="search-filters" id="watches-search-filters">
            {WATCH_METRICS.map((metric) => (
              <div className="filter-row" key={metric.key}>
                <span className="filter-label">{metric.rowLabel} (mm)</span>
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
      </div>

      <div className="watches-page-head">
        <div>
          <h1 className="page-title">Watch database</h1>
          <p className="lede watches-lede">Approved records with watch names and lug-to-lug dimensions. Search or filter the list to find matching references.</p>
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

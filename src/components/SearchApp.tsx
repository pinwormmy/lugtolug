import {
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { getWatchHref, searchTextMatchesQuery, WATCH_METRICS } from "@/lib/watch";
import { getCompactReferenceSearchText, groupWatchesForDisplay, shouldUseCompactReferenceSearch, type WatchDisplayGroup } from "@/lib/watchGroups";
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

type Unit = "mm" | "in";
type SortKey = "recent" | "lug-asc" | "lug-desc" | "case-asc" | "case-desc";

function formatDimension(value: number | null | undefined, unit: Unit): string {
  if (value == null) return "N/A";
  if (unit === "in") return `${(value / 25.4).toFixed(2)} in`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} mm`;
}

function sortWatches(watches: WatchDisplayGroup[], sort: SortKey): WatchDisplayGroup[] {
  const sorted = [...watches];
  sorted.sort((a, b) => {
    if (sort === "lug-asc") return a.lugToLugMm - b.lugToLugMm;
    if (sort === "lug-desc") return b.lugToLugMm - a.lugToLugMm;
    if (sort === "case-asc") return (a.caseMm ?? Number.POSITIVE_INFINITY) - (b.caseMm ?? Number.POSITIVE_INFINITY);
    if (sort === "case-desc") return (b.caseMm ?? -1) - (a.caseMm ?? -1);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return sorted;
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 620px)").matches;
  });
  const [filters, setFilters] = useState<DimensionFilters>(() => createEmptyDimensionFilters());
  const [unit, setUnit] = useState<Unit>("mm");
  const [sort, setSort] = useState<SortKey>("lug-asc");
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const normalized = normalizeSearch(deferredQuery);
  const compactReferenceQuery = getCompactReferenceSearchText(deferredQuery);
  const shouldMatchCompactReference = shouldUseCompactReferenceSearch(compactReferenceQuery);
  const isPending = query !== deferredQuery;
  const hasActiveFilters = hasActiveDimensionFilters(filters);
  const shouldShowFilteredState = Boolean(hasSearchQuery || hasActiveFilters);

  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches, deferredQuery), [deferredQuery, watches]);
  const filtered = useMemo(() => {
    const dimensionFiltered = filterWatchesByDimensions(groupedWatches, filters);
    const searched = hasSearchQuery
      ? dimensionFiltered.filter((watch) => (
          (normalized.length > 0 && searchTextMatchesQuery(watch.groupSearchText, deferredQuery)) ||
          (shouldMatchCompactReference && watch.groupCompactReferenceSearchText.includes(compactReferenceQuery))
        ))
      : dimensionFiltered;
    return sortWatches(searched, sort);
  }, [compactReferenceQuery, deferredQuery, filters, groupedWatches, hasSearchQuery, normalized, shouldMatchCompactReference, sort]);

  const results = filtered.slice(0, 80);

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = shouldShowFilteredState;
    return () => {
      recentSection.hidden = false;
    };
  }, [shouldShowFilteredState]);

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

  const submitSearch: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setQuery(searchInputRef.current?.value ?? query);
  };

  return (
    <section className={`database-workbench${shouldShowFilteredState ? " has-filtered-state" : ""}`} aria-label="Lug to Lug Finder database">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find the watch you want, then jump straight to the full spec page.</h1>
          <p>Search watches, references, or dimensions in one box. When results appear, they stay compact: watch name and lug-to-lug only.</p>
        </div>
        <div className="status-strip" aria-label="Database status">
          <span>{groupedWatches.length.toLocaleString()} records</span>
        </div>
      </div>

      <div className="database-controls">
        <form className="search-grid" role="search" onSubmit={submitSearch}>
          <label>
            <span>Search watches, references, or dimensions</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInputRef}
                className="input"
                aria-label="Search watches by name, reference, or dimensions"
                placeholder="e.g., Omega Speedmaster, 310.30, or 47.5"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
          <button className="button accent" type="submit">Search</button>
          {filtersOpen && (
            <button className="button secondary reset-button" type="button" onClick={resetFilters}>
              <RotateCcw size={16} aria-hidden="true" />
              Reset
            </button>
          )}
          <div className="segmented" aria-label="Display units">
            <button type="button" className={unit === "mm" ? "active" : ""} onClick={() => setUnit("mm")}>mm</button>
            <button type="button" className={unit === "in" ? "active" : ""} onClick={() => setUnit("in")}>in</button>
          </div>
        </form>

        <div className="filter-toolbar">
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
          <div className="active-filter-chips" aria-label="Active filters">
            {WATCH_METRICS.map((metric) => {
              const filter = filters[metric.key];
              const label = [filter.min && `>${filter.min}`, filter.max && `<${filter.max}`].filter(Boolean).join(" ");
              return label ? <span key={metric.key}>{metric.rowLabel} {label}</span> : null;
            })}
            {!hasActiveFilters && <span>All dimensions</span>}
          </div>
        </div>

        {filtersOpen && (
          <div className="search-filters" id="search-filters">
            {WATCH_METRICS.map((metric) => (
              <div className="filter-row" key={metric.key}>
                <span className="filter-label">{metric.rowLabel} ({unit})</span>
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

      {shouldShowFilteredState && (
        <div className="database-layout database-layout--results-only">
          <section className="results-panel" aria-busy={isPending}>
            <div className="results-head">
              <strong>{filtered.length.toLocaleString()} results</strong>
              <label>
                <span>Sort by</span>
                <select className="select compact-select" value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
                  <option value="lug-asc">Lug-to-lug asc</option>
                  <option value="lug-desc">Lug-to-lug desc</option>
                  <option value="case-asc">Case asc</option>
                  <option value="case-desc">Case desc</option>
                  <option value="recent">Recently added</option>
                </select>
              </label>
            </div>
            <div className="watch-list search-results-list" aria-label="Watch results">
              {results.map((watch) => {
                const href = getWatchHref(watch);
                return (
                  <a
                    className="watch-row watch-row--summary search-result"
                    href={href}
                    key={watch.id}
                    aria-label={`Open ${watch.brand} ${watch.model} full specs`}
                  >
                    <div className="watch-summary search-result-summary">
                      <div className="watch-summary-name">
                        <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                        <small className="search-result-reference">{watch.reference || "Reference not provided"}</small>
                      </div>
                      <strong className="watch-summary-size">{formatDimension(watch.lugToLugMm, unit)}</strong>
                    </div>
                  </a>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="empty-state">No matching watches yet. Submit a source and the operator can review it.</p>
            )}
            {filtered.length > results.length && <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>}
          </section>
        </div>
      )}
    </section>
  );
}

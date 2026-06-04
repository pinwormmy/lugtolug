import { Search, SlidersHorizontal, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { getWatchHref, searchTextMatchesQuery, WATCH_METRICS } from "@/lib/watch";
import {
  createEmptyDimensionFilters,
  hasActiveDimensionFilters,
  watchMatchesDimensionFilters
} from "@/lib/watchFilters";
import {
  getCompactReferenceSearchText,
  groupWatchesForDisplay,
  shouldUseCompactReferenceSearch,
  type WatchDisplayGroup
} from "@/lib/watchGroups";

interface Props {
  watches: WatchWithSources[];
}

type SortKey = "recent" | "lug-asc" | "lug-desc";

function compactDimension(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function sourceLabel(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl.replace(/^https?:\/\//, "").split("/")[0] || sourceUrl;
  }
}

function sortWatches(watches: WatchDisplayGroup[], sort: SortKey): WatchDisplayGroup[] {
  const sorted = [...watches];
  sorted.sort((a, b) => {
    if (sort === "lug-asc") return a.lugToLugMm - b.lugToLugMm;
    if (sort === "lug-desc") return b.lugToLugMm - a.lugToLugMm;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return sorted;
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("lug-asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dimensionFilters, setDimensionFilters] = useState(() => createEmptyDimensionFilters());
  const [showFilters, setShowFilters] = useState(false);
  const detailPanelRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);
  const normalized = normalizeSearch(deferredQuery);
  const compactReferenceQuery = getCompactReferenceSearchText(deferredQuery);
  const shouldMatchCompactReference = shouldUseCompactReferenceSearch(compactReferenceQuery);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const hasActiveFilters = hasActiveDimensionFilters(dimensionFilters);
  const isPending = query !== deferredQuery;
  const shouldShowResults = hasSearchQuery || hasActiveFilters;
  const activeFilterCount = Object.values(dimensionFilters).reduce(
    (count, filter) => count + Number(Boolean(filter.min.trim())) + Number(Boolean(filter.max.trim())),
    0
  );

  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches, deferredQuery), [deferredQuery, watches]);
  const filtered = useMemo(() => {
    const matches = groupedWatches.filter((watch) => {
      const matchesSearch = !hasSearchQuery || (
        (normalized.length > 0 && searchTextMatchesQuery(watch.groupSearchText, deferredQuery)) ||
        (shouldMatchCompactReference && watch.groupCompactReferenceSearchText.includes(compactReferenceQuery))
      );
      const matchesDimensions = !hasActiveFilters || watchMatchesDimensionFilters(watch, dimensionFilters);
      return matchesSearch && matchesDimensions;
    });
    return sortWatches(matches, sort);
  }, [
    compactReferenceQuery,
    deferredQuery,
    dimensionFilters,
    groupedWatches,
    hasActiveFilters,
    hasSearchQuery,
    normalized,
    shouldMatchCompactReference,
    sort
  ]);

  const results = filtered.slice(0, 80);
  const selected = selectedId == null ? null : filtered.find((watch) => watch.id === selectedId) ?? null;

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = shouldShowResults;
    return () => {
      recentSection.hidden = false;
    };
  }, [shouldShowResults]);

  useEffect(() => {
    setSelectedId(null);
  }, [deferredQuery, dimensionFilters]);

  useEffect(() => {
    if (!selected) return;
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  function updateFilterValue(metricKey: keyof typeof dimensionFilters, bound: "min" | "max", value: string) {
    setDimensionFilters((current) => ({
      ...current,
      [metricKey]: {
        ...current[metricKey],
        [bound]: value
      }
    }));
  }

  function clearFilters() {
    setDimensionFilters(createEmptyDimensionFilters());
  }

  return (
    <section className={`database-workbench${shouldShowResults ? " has-filtered-state" : ""}`} aria-label="Lug to Lug Finder search">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find a watch by name or reference.</h1>
          <p>Search results stay compact. Select a watch to inspect its full record.</p>
        </div>
        <div className="status-strip" aria-label="Database status">
          <span>{groupedWatches.length.toLocaleString()} records</span>
        </div>
      </div>

      <div className="database-controls">
        <div className="search-panel" role="search">
          <label>
            <span>Search watches or references</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
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
              className={`button secondary search-filter-toggle${showFilters ? " active" : ""}`}
              type="button"
              aria-expanded={showFilters}
              aria-controls="search-filters-panel"
              onClick={() => setShowFilters((current) => !current)}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && <span className="filter-pill">{activeFilterCount}</span>}
            </button>

            {hasActiveFilters && (
              <button className="button secondary reset-button" type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {showFilters && (
            <div className="search-filters" id="search-filters-panel">
              {WATCH_METRICS.map((metric) => (
                <div className="filter-row" key={metric.key}>
                  <span className="filter-label">{metric.detailLabel}</span>
                  <div className="filter-range">
                    <label>
                      <span>Min</span>
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder="Any"
                        value={dimensionFilters[metric.key].min}
                        onChange={(event) => updateFilterValue(metric.key, "min", event.currentTarget.value)}
                      />
                    </label>
                    <label>
                      <span>Max</span>
                      <input
                        className="input"
                        inputMode="decimal"
                        placeholder="Any"
                        value={dimensionFilters[metric.key].max}
                        onChange={(event) => updateFilterValue(metric.key, "max", event.currentTarget.value)}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {shouldShowResults && (
        <div className="database-layout">
          <section className="results-panel" aria-busy={isPending}>
            <div className="results-head">
              <strong>{filtered.length.toLocaleString()} results</strong>
              <label>
                <span>Sort by</span>
                <select className="select compact-select" value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
                  <option value="lug-asc">Lug-to-lug asc</option>
                  <option value="lug-desc">Lug-to-lug desc</option>
                  <option value="recent">Recently added</option>
                </select>
              </label>
            </div>
            <div className="watch-result-list" aria-label="Watch results">
              {results.map((watch) => {
                const isSelected = selected?.id === watch.id;
                const detailId = `watch-result-detail-${watch.id}`;
                return (
                  <div className="watch-result-item" key={watch.id}>
                    <button
                      className={`watch-result-row${isSelected ? " selected" : ""}`}
                      type="button"
                      onClick={() => setSelectedId(watch.id)}
                      aria-current={isSelected ? "true" : undefined}
                      aria-expanded={isSelected ? "true" : "false"}
                      aria-controls={detailId}
                      aria-label={`${watch.brand} ${watch.model} details`}
                    >
                      <span className="watch-result-name">
                        <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                      </span>
                      <span className="watch-result-size">
                        <strong>{compactDimension(watch.lugToLugMm)}</strong>
                        <small>mm</small>
                      </span>
                    </button>

                    {isSelected && selected && (
                      <div className="watch-result-detail" id={detailId} ref={detailPanelRef} tabIndex={-1}>
                        <div className="watch-result-detail-head">
                          <div>
                            <p className="eyebrow">Selected watch</p>
                            <h2>{[selected.brand, selected.model].filter(Boolean).join(" ")}</h2>
                            <p>{selected.reference || "Reference not provided"}</p>
                          </div>
                          <button className="icon-button" type="button" aria-label="Close selected watch detail" onClick={() => setSelectedId(null)}>
                            <X size={16} aria-hidden="true" />
                          </button>
                        </div>

                        <p className="small">Confidence: <strong>{selected.confidence}</strong></p>

                        <div className="source-list">
                          <p className="eyebrow">Sources</p>
                          {selected.sources.length > 0 ? selected.sources.map((source) => (
                            <a href={source.sourceUrl} key={source.id} target="_blank" rel="noreferrer">
                              {sourceLabel(source.sourceUrl)}
                              {source.note && <small>{source.note}</small>}
                            </a>
                          )) : <p className="small">No sources attached.</p>}
                        </div>

                        <p className="small">Measurements may vary by reference. Verify the source before purchase.</p>
                        <a className="button secondary" href={getWatchHref(selected)}>Open full record</a>
                      </div>
                    )}
                  </div>
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

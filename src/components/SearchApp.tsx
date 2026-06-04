import { useDeferredValue, useEffect, useMemo, useState } from "react";
import SearchFilters from "@/components/search/SearchFilters";
import WatchSearchResults, { type WatchSortKey } from "@/components/search/WatchSearchResults";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { searchTextMatchesQuery } from "@/lib/watch";
import {
  createEmptyDimensionFilters,
  hasActiveDimensionFilters,
  watchMatchesDimensionFilters,
  type DimensionKey
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

function sortWatches(watches: WatchDisplayGroup[], sort: WatchSortKey): WatchDisplayGroup[] {
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
  const [sort, setSort] = useState<WatchSortKey>("lug-asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dimensionFilters, setDimensionFilters] = useState(() => createEmptyDimensionFilters());
  const [showFilters, setShowFilters] = useState(false);
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

  function updateFilterValue(metricKey: DimensionKey, bound: "min" | "max", value: string) {
    setDimensionFilters((current) => ({
      ...current,
      [metricKey]: {
        ...current[metricKey],
        [bound]: value
      }
    }));
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

      <SearchFilters
        activeFilterCount={activeFilterCount}
        dimensionFilters={dimensionFilters}
        hasActiveFilters={hasActiveFilters}
        onClear={() => setDimensionFilters(createEmptyDimensionFilters())}
        onQueryChange={setQuery}
        onToggle={() => setShowFilters((current) => !current)}
        onUpdate={updateFilterValue}
        query={query}
        showFilters={showFilters}
      />

      {shouldShowResults && (
        <WatchSearchResults
          filteredCount={filtered.length}
          isPending={isPending}
          onClearSelected={() => setSelectedId(null)}
          onSelect={setSelectedId}
          onSortChange={setSort}
          results={results}
          selected={selected}
          sort={sort}
        />
      )}
    </section>
  );
}

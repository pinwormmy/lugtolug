import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { getWatchHref, searchTextMatchesQuery, WATCH_METRICS } from "@/lib/watch";
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

function formatDimension(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} mm`;
}

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
  const detailPanelRef = useRef<HTMLElement>(null);
  const deferredQuery = useDeferredValue(query);
  const normalized = normalizeSearch(deferredQuery);
  const compactReferenceQuery = getCompactReferenceSearchText(deferredQuery);
  const shouldMatchCompactReference = shouldUseCompactReferenceSearch(compactReferenceQuery);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const isPending = query !== deferredQuery;

  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches, deferredQuery), [deferredQuery, watches]);
  const filtered = useMemo(() => {
    if (!hasSearchQuery) return [];

    const matches = groupedWatches.filter((watch) => (
      (normalized.length > 0 && searchTextMatchesQuery(watch.groupSearchText, deferredQuery)) ||
      (shouldMatchCompactReference && watch.groupCompactReferenceSearchText.includes(compactReferenceQuery))
    ));
    return sortWatches(matches, sort);
  }, [compactReferenceQuery, deferredQuery, groupedWatches, hasSearchQuery, normalized, shouldMatchCompactReference, sort]);

  const results = filtered.slice(0, 80);
  const selected = selectedId == null ? null : filtered.find((watch) => watch.id === selectedId) ?? null;

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = hasSearchQuery;
    return () => {
      recentSection.hidden = false;
    };
  }, [hasSearchQuery]);

  useEffect(() => {
    setSelectedId(null);
  }, [deferredQuery]);

  useEffect(() => {
    if (!selected) return;
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  return (
    <section className={`database-workbench${hasSearchQuery ? " has-filtered-state" : ""}`} aria-label="Lug to Lug Finder search">
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
        </div>
      </div>

      {hasSearchQuery && (
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
                return (
                  <button
                    className={`watch-result-row${isSelected ? " selected" : ""}`}
                    key={watch.id}
                    type="button"
                    onClick={() => setSelectedId(watch.id)}
                    aria-current={isSelected ? "true" : undefined}
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
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="empty-state">No matching watches yet. Submit a source and the operator can review it.</p>
            )}
            {filtered.length > results.length && <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>}
          </section>

          {selected && (
            <aside className="detail-panel" aria-label="Selected watch detail" ref={detailPanelRef} tabIndex={-1}>
              <div className="detail-panel-head">
                <div>
                  <p className="eyebrow">Selected watch</p>
                  <h2>{[selected.brand, selected.model].filter(Boolean).join(" ")}</h2>
                  <p>{selected.reference || "Reference not provided"}</p>
                </div>
                <button className="icon-button" type="button" aria-label="Close selected watch detail" onClick={() => setSelectedId(null)}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="spec-list">
                {WATCH_METRICS.map((metric) => (
                  <span key={metric.key}>
                    <small>{metric.detailLabel}</small>
                    <strong>{formatDimension(selected[metric.key])}</strong>
                  </span>
                ))}
                <span>
                  <small>Confidence</small>
                  <strong>{selected.confidence}</strong>
                </span>
              </div>

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
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

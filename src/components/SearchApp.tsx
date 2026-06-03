import { Bookmark, Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentProps } from "react";
import type { WatchWithSources } from "@/types";
import { getWatchHref, searchTextMatchesQuery } from "@/lib/watch";

interface Props {
  watches: WatchWithSources[];
}

type SortKey = "recent" | "name-asc" | "name-desc";

const SAVED_STORAGE_KEY = "lugtolug.saved.v1";

function readStoredIds(key: string): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is number => Number.isInteger(value)) : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, values: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(values));
}

function sourceLabel(watch: WatchWithSources): string {
  const source = watch.sources[0]?.sourceUrl;
  if (!source) return "No source";
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source.replace(/^https?:\/\//, "").split("/")[0] || source;
  }
}

function sortWatches(watches: WatchWithSources[], sort: SortKey): WatchWithSources[] {
  const sorted = [...watches];
  sorted.sort((a, b) => {
    if (sort === "name-asc") {
      return [a.brand, a.model, a.reference].filter(Boolean).join(" ").localeCompare(
        [b.brand, b.model, b.reference].filter(Boolean).join(" ")
      );
    }

    if (sort === "name-desc") {
      return [b.brand, b.model, b.reference].filter(Boolean).join(" ").localeCompare(
        [a.brand, a.model, a.reference].filter(Boolean).join(" ")
      );
    }

    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return sorted;
}

export default function SearchApp({ watches }: Props) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [savedIds, setSavedIds] = useState<number[]>(() => readStoredIds(SAVED_STORAGE_KEY));
  const [sort, setSort] = useState<SortKey>("recent");
  const deferredQuery = useDeferredValue(query);
  const hasSearchQuery = deferredQuery.trim().length > 0;
  const isPending = query !== deferredQuery;

  const filtered = useMemo(() => {
    if (!hasSearchQuery) return [];
    const searched = watches.filter((watch) => (
      searchTextMatchesQuery([watch.brand, watch.model, watch.reference].filter(Boolean).join(" "), deferredQuery)
    ));
    return sortWatches(searched, sort);
  }, [deferredQuery, hasSearchQuery, sort, watches]);

  const results = filtered.slice(0, 80);

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = hasSearchQuery;
    return () => {
      recentSection.hidden = false;
    };
  }, [hasSearchQuery]);

  useEffect(() => {
    writeStoredIds(SAVED_STORAGE_KEY, savedIds);
    window.dispatchEvent(new Event("lugtolug:saved-change"));
  }, [savedIds]);

  function toggleSaved(id: number) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  const submitSearch: ComponentProps<"form">["onSubmit"] = (event) => {
    event.preventDefault();
    setQuery(searchInputRef.current?.value ?? query);
  };

  return (
    <section className={`database-workbench${hasSearchQuery ? " has-filtered-state" : ""}`} aria-label="Lug to Lug Finder database">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find the watch record you need.</h1>
          <p>Search by brand, model, or reference, then open the full record for the published measurements and sources.</p>
        </div>
        <div className="status-strip" aria-label="Database status">
          <span>{watches.length.toLocaleString()} records</span>
          <span>{savedIds.length} saved</span>
        </div>
      </div>

      <div className="database-controls">
        <form className="search-grid" role="search" onSubmit={submitSearch}>
          <label>
            <span>Search watches or references</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                ref={searchInputRef}
                className="input"
                aria-label="Search watches by name or reference"
                placeholder="e.g., Omega Speedmaster or 310.30"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
          <button className="button accent" type="submit">Search</button>
          {hasSearchQuery && (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
              Clear
            </button>
          )}
          <label className="sort-control">
            <span>Sort by</span>
            <select className="select compact-select" value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
              <option value="recent">Recently added</option>
              <option value="name-asc">Name asc</option>
              <option value="name-desc">Name desc</option>
            </select>
          </label>
        </form>
      </div>

      {hasSearchQuery && (
        <div className="database-layout">
          <section className="results-panel" aria-busy={isPending}>
            <div className="results-head">
              <strong>{filtered.length.toLocaleString()} results</strong>
            </div>
            <div className="database-table" role="table" aria-label="Watch results">
              <div className="database-row database-row-head" role="row">
                <span>Brand / model</span>
                <span>Reference</span>
                <span>Source</span>
                <span>Conf.</span>
                <span>Actions</span>
              </div>
              {results.map((watch) => {
                const isSaved = savedIds.includes(watch.id);
                return (
                  <article
                    className="database-row"
                    key={watch.id}
                    role="row"
                    tabIndex={0}
                    onClick={() => {
                      window.location.href = getWatchHref(watch);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        window.location.href = getWatchHref(watch);
                      }
                    }}
                  >
                    <span className="row-name">
                      <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                      <small>Open full record</small>
                    </span>
                    <span>{watch.reference || "Reference not provided"}</span>
                    <span>{sourceLabel(watch)}</span>
                    <span>{watch.confidence}</span>
                    <span className="row-actions">
                      <button
                        type="button"
                        className={isSaved ? "icon-button active" : "icon-button"}
                        aria-label={isSaved ? "Remove saved watch" : "Save watch"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSaved(watch.id);
                        }}
                      >
                        <Bookmark size={15} aria-hidden="true" />
                      </button>
                    </span>
                  </article>
                );
              })}
            </div>
            {results.length === 0 && (
              <p className="empty-state">No matching watches yet. Try a different brand or reference.</p>
            )}
            {filtered.length > results.length && <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>}
          </section>
        </div>
      )}
    </section>
  );
}

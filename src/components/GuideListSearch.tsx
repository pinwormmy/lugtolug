import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useWatchDatabase } from "@/hooks/useWatchDatabase";
import { filterGuideWatches, type GuideListSort } from "@/lib/guideList";
import { formatMm, getWatchDisplayName, getWatchHref } from "@/lib/watch";
import type { Watch } from "@/types";

interface Props {
  /** Server-chosen rows shown until the visitor types. */
  initialWatches: Watch[];
  /** How many watches the page's range holds in total. */
  totalCount: number;
  minMm?: number;
  maxMm?: number;
  genreSlug?: string;
  sort: GuideListSort;
  sweetSpotMm?: number;
  /** Plural noun for messages, e.g. "watches" or "dive watches". */
  noun: string;
}

const PAGE_SIZE = 48;

// The guide pages render their top rows on the server; this island adds a
// search box over the whole catalog restricted to the same range. The catalog
// (~7k summaries) is only fetched once the visitor focuses the field.
export default function GuideListSearch({ initialWatches, totalCount, minMm, maxMm, genreSlug, sort, sweetSpotMm, noun }: Props) {
  const [query, setQuery] = useState("");
  const [catalogWanted, setCatalogWanted] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);
  const hasQuery = deferredQuery.trim().length > 0;
  const { watches: catalog, status, retry } = useWatchDatabase(initialWatches, catalogWanted);

  const results = useMemo(
    () => (hasQuery ? filterGuideWatches(catalog, { minMm, maxMm, genreSlug, query: deferredQuery, sort, sweetSpotMm }) : initialWatches),
    [catalog, deferredQuery, genreSlug, hasQuery, initialWatches, maxMm, minMm, sort, sweetSpotMm]
  );
  const visible = results.slice(0, limit);
  const loadingCatalog = catalogWanted && status === "loading";

  return (
    <div className="guide-search">
      <div className="watches-search-bar database-controls">
        <label>
          <span>Search within these {noun}</span>
          <div className="field-with-icon">
            <Search size={17} aria-hidden="true" />
            <input
              className="input"
              aria-label={`Search within these ${noun}`}
              placeholder="Brand, model, or reference"
              value={query}
              onFocus={() => setCatalogWanted(true)}
              onChange={(event) => {
                setCatalogWanted(true);
                setLimit(PAGE_SIZE);
                setQuery(event.currentTarget.value);
              }}
            />
          </div>
        </label>
        <p className="small guide-search-status">
          {!hasQuery && `Showing ${visible.length.toLocaleString("en-US")} of ${totalCount.toLocaleString("en-US")} ${noun}. Type to search all of them.`}
          {hasQuery && loadingCatalog && "Loading the full list…"}
          {hasQuery && status === "error" && (
            <>
              Couldn&apos;t load the full list.{" "}
              <button className="link-button" onClick={retry} type="button">Retry</button>
            </>
          )}
          {hasQuery && status === "ready" && `${results.length.toLocaleString("en-US")} matching ${noun}, one per model family.`}
        </p>
      </div>

      {visible.length > 0 ? (
        <div className="related-watch-grid">
          {visible.map((watch) => (
            <a className="watch-row watch-row--summary" href={getWatchHref(watch)} key={watch.id}>
              <div className="watch-summary">
                <div className="watch-summary-name">
                  <strong>{getWatchDisplayName(watch)}</strong>
                </div>
                <strong className="watch-summary-size">{formatMm(watch.lugToLugMm)}</strong>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="empty-state">{hasQuery && !loadingCatalog ? `No matching ${noun} in this range.` : `Nothing in this range yet.`}</p>
      )}

      {results.length > visible.length && (
        <p className="guide-search-more">
          <button className="button secondary" onClick={() => setLimit((current) => current + PAGE_SIZE)} type="button">
            Show {Math.min(PAGE_SIZE, results.length - visible.length)} more
          </button>
        </p>
      )}
    </div>
  );
}

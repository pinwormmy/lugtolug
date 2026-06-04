import { getWatchHref } from "@/lib/watch";
import type { WatchDisplayGroup } from "@/lib/watchGroups";

export type WatchSortKey = "recent" | "lug-asc" | "lug-desc";

interface Props {
  filteredCount: number;
  isPending: boolean;
  results: WatchDisplayGroup[];
  sort: WatchSortKey;
  onSortChange: (sort: WatchSortKey) => void;
}

function compactDimension(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

export default function WatchSearchResults({
  filteredCount,
  isPending,
  results,
  sort,
  onSortChange
}: Props) {
  return (
    <div className="database-layout">
      <section className="results-panel" aria-busy={isPending}>
        <div className="results-head">
          <strong>{filteredCount.toLocaleString()} results</strong>
          <label>
            <span>Sort by</span>
            <select
              className="select compact-select"
              value={sort}
              onChange={(event) => onSortChange(event.currentTarget.value as WatchSortKey)}
            >
              <option value="lug-asc">Lug-to-lug asc</option>
              <option value="lug-desc">Lug-to-lug desc</option>
              <option value="recent">Recently added</option>
            </select>
          </label>
        </div>

        <div className="watch-result-list" aria-label="Watch results">
          {results.map((watch) => {
            return (
              <div className="watch-result-item" key={watch.id}>
                <a
                  className="watch-result-row"
                  href={getWatchHref(watch)}
                  aria-label={`${watch.brand} ${watch.model} details`}
                >
                  <span className="watch-result-name">
                    <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                  </span>
                  <span className="watch-result-size">
                    <strong>{compactDimension(watch.lugToLugMm)}</strong>
                    <small>mm</small>
                  </span>
                </a>
              </div>
            );
          })}
        </div>

        {results.length === 0 && (
          <p className="empty-state">No matching watches yet. Submit a source and the operator can review it.</p>
        )}
        {filteredCount > results.length && (
          <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>
        )}
      </section>
    </div>
  );
}

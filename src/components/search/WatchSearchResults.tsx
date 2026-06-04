import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { getWatchHref } from "@/lib/watch";
import type { WatchDisplayGroup } from "@/lib/watchGroups";

export type WatchSortKey = "recent" | "lug-asc" | "lug-desc";

interface Props {
  filteredCount: number;
  isPending: boolean;
  results: WatchDisplayGroup[];
  selected: WatchDisplayGroup | null;
  sort: WatchSortKey;
  onSortChange: (sort: WatchSortKey) => void;
  onSelect: (id: number) => void;
  onClearSelected: () => void;
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

export default function WatchSearchResults({
  filteredCount,
  isPending,
  results,
  selected,
  sort,
  onSortChange,
  onSelect,
  onClearSelected
}: Props) {
  const detailPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

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
            const isSelected = selected?.id === watch.id;
            const detailId = `watch-result-detail-${watch.id}`;
            return (
              <div className="watch-result-item" key={watch.id}>
                <button
                  className={`watch-result-row${isSelected ? " selected" : ""}`}
                  type="button"
                  onClick={() => onSelect(watch.id)}
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
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Close selected watch detail"
                        onClick={onClearSelected}
                      >
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
        {filteredCount > results.length && (
          <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>
        )}
      </section>
    </div>
  );
}

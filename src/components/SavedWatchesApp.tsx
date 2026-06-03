import { Bookmark, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WatchWithSources } from "@/types";
import { formatMm, getWatchHref } from "@/lib/watch";
import { groupWatchesForDisplay, type WatchDisplayGroup } from "@/lib/watchGroups";

interface Props {
  watches: WatchWithSources[];
}

const SAVED_STORAGE_KEY = "lugtolug.saved.v1";

function readStoredIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is number => Number.isInteger(value)) : [];
  } catch {
    return [];
  }
}

function writeStoredIds(values: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(values));
}

function WatchCard({ watch, onRemove }: { watch: WatchDisplayGroup; onRemove: (id: number) => void }) {
  return (
    <article className="watch-row saved-row">
      <a className="saved-row-link" href={getWatchHref(watch)}>
        <div className="watch-summary">
          <div className="watch-summary-name">
            <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
            <span>
              {watch.reference || "Reference not provided"}
              {watch.variantCount > 1 ? ` · ${watch.variantCount} references` : ""}
            </span>
          </div>
          <strong className="watch-summary-size">{formatMm(watch.lugToLugMm)}</strong>
        </div>
      </a>
      <button
        className="icon-button saved-row-remove"
        type="button"
        aria-label="Remove saved watch"
        onClick={() => onRemove(watch.id)}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function SavedWatchesApp({ watches }: Props) {
  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches), [watches]);
  const groupedById = useMemo(() => new Map(groupedWatches.map((watch) => [watch.id, watch])), [groupedWatches]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setSavedIds(readStoredIds());
      setIsReady(true);
    };

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    writeStoredIds(savedIds);
  }, [isReady, savedIds]);

  const savedWatches = useMemo(
    () => savedIds.map((id) => groupedById.get(id)).filter((watch): watch is WatchDisplayGroup => Boolean(watch)),
    [groupedById, savedIds]
  );

  function toggleSaved(id: number) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function clearSaved() {
    setSavedIds([]);
  }

  return (
    <section className="database-workbench" aria-label="Saved watches">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Saved</p>
          <h1>Watches saved in this browser.</h1>
          <p>Saved items live in localStorage, so they stay on this device and browser only.</p>
        </div>
        <div className="status-strip" aria-label="Saved status">
          <span>{isReady ? `${savedWatches.length} saved` : "Loading saved items"}</span>
          <span>{savedIds.length} stored ids</span>
        </div>
      </div>

      <div className="database-layout">
        <section className="results-panel">
          <div className="results-head">
            <strong>{savedWatches.length.toLocaleString()} saved watches</strong>
            <button className="button secondary" type="button" onClick={clearSaved} disabled={savedIds.length === 0}>
              <RotateCcw size={16} aria-hidden="true" />
              Clear all
            </button>
          </div>

          {!isReady ? (
            <p className="empty-state">Reading your saved list.</p>
          ) : savedWatches.length > 0 ? (
            <div className="watch-list">
              {savedWatches.map((watch) => (
                <WatchCard key={watch.id} watch={watch} onRemove={toggleSaved} />
              ))}
            </div>
          ) : (
            <p className="empty-state">
              No saved watches yet. Go back to search and press the bookmark on any watch row.
            </p>
          )}
        </section>

        <aside className="detail-panel" aria-label="Saved watches help">
          <div className="detail-panel-head">
            <div>
              <p className="eyebrow">How it works</p>
              <h2>Local only</h2>
            </div>
            <Bookmark size={18} aria-hidden="true" />
          </div>
          <div className="detail-tab-panel">
            <p className="small">The saved list uses the key <code>lugtolug.saved.v1</code> in this browser.</p>
            <p className="small">If you clear browser storage or switch devices, the list is gone.</p>
            <a className="button secondary" href="/">
              Back to search
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}

import {
  Bookmark,
  ChevronDown,
  Gauge,
  GitCompareArrows,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { WatchWithSources } from "@/types";
import { getFitGuidance, mmToInches } from "@/lib/fit";
import { normalizeSearch } from "@/lib/slug";
import { getWatchHref, WATCH_METRICS } from "@/lib/watch";
import { getCompactReferenceSearchText, groupWatchesForDisplay, type WatchDisplayGroup } from "@/lib/watchGroups";
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
type DetailTab = "dimensions" | "specs" | "sources" | "notes";

const SAVED_STORAGE_KEY = "lugtolug.saved.v1";
const COMPARE_STORAGE_KEY = "lugtolug.compare.v1";

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

function formatDimension(value: number | null | undefined, unit: Unit): string {
  if (value == null) return "N/A";
  if (unit === "in") return `${mmToInches(value).toFixed(2)} in`;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)} mm`;
}

function compactDimension(value: number | null | undefined, unit: Unit): string {
  if (value == null) return "N/A";
  if (unit === "in") return mmToInches(value).toFixed(2);
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function sourceLabel(watch: WatchDisplayGroup): string {
  const source = watch.sources[0]?.sourceUrl;
  if (!source) return "No source";
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return source.replace(/^https?:\/\//, "").split("/")[0] || source;
  }
}

function confidenceScore(confidence: WatchDisplayGroup["confidence"]): number {
  if (confidence === "high") return 4;
  if (confidence === "medium") return 3;
  return 2;
}

function ConfidenceDots({ confidence }: { confidence: WatchDisplayGroup["confidence"] }) {
  const score = confidenceScore(confidence);
  return (
    <span className="confidence-dots" aria-label={`${confidence} confidence`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span className={index < score ? "active" : ""} key={index} />
      ))}
    </span>
  );
}

function WatchDiagram({ watch, unit }: { watch: WatchDisplayGroup; unit: Unit }) {
  return (
    <div className="dimension-diagram" aria-label="Technical dimension diagram">
      <svg viewBox="0 0 420 210" role="img">
        <title>{`${watch.brand} ${watch.model} dimensions`}</title>
        <defs>
          <marker id="arrow" markerHeight="8" markerWidth="8" orient="auto" refX="4" refY="4">
            <path d="M0 0 8 4 0 8Z" />
          </marker>
        </defs>
        <g className="diagram-grid">
          {Array.from({ length: 8 }, (_, index) => (
            <path d={`M${50 + index * 30} 20v150`} key={`v-${index}`} />
          ))}
          {Array.from({ length: 5 }, (_, index) => (
            <path d={`M48 ${35 + index * 28}h230`} key={`h-${index}`} />
          ))}
        </g>
        <g className="diagram-watch">
          <circle cx="160" cy="96" r="48" />
          <path d="M130 50V20M190 50V20M130 142v30M190 142v30" />
          <path d="M112 96h-16M224 96h16" />
          <circle cx="160" cy="96" r="3" />
          <path d="M160 48v96M112 96h96" />
        </g>
        <g className="diagram-measure">
          <path d="M84 22v148" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <path d="M112 164h96" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <path d="M294 52v88" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
          <path d="M342 62h42" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
        </g>
        <g className="diagram-side">
          <rect height="88" rx="8" width="34" x="292" y="52" />
          <path d="M309 45v102M292 82h34M292 110h34" />
          <rect height="42" rx="4" width="44" x="342" y="74" />
          <path d="M342 68h44M342 122h44" />
        </g>
      </svg>
      <div className="diagram-labels">
        <span>
          <strong>{formatDimension(watch.lugToLugMm, unit)}</strong>
          Lug to lug
        </span>
        <span>
          <strong>{formatDimension(watch.caseMm, unit)}</strong>
          Case
        </span>
        <span>
          <strong>{formatDimension(watch.thicknessMm, unit)}</strong>
          Thickness
        </span>
        <span>
          <strong>{formatDimension(watch.lugWidthMm, unit)}</strong>
          Lug width
        </span>
      </div>
    </div>
  );
}

function FitAnalyzer({ lugToLugMm }: { lugToLugMm: number }) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [value, setValue] = useState("17.0");
  const wristMm = unit === "cm" ? Number(value) * 10 : Number(value) * 25.4;
  const fit = Number.isFinite(wristMm) && wristMm > 0 ? getFitGuidance(lugToLugMm, wristMm) : null;
  const ratioPosition = fit ? Math.max(0, Math.min(100, ((fit.ratio - 0.5) / 0.6) * 100)) : 0;

  return (
    <section className="fit-analyzer" aria-label="Wrist fit analyzer">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Wrist fit analyzer</p>
          <h3>Fit reference</h3>
        </div>
        <Gauge size={18} aria-hidden="true" />
      </div>
      <div className="fit-controls">
        <label>
          <span>Wrist circumference</span>
          <input
            className="input"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Unit</span>
          <select className="select" value={unit} onChange={(event) => setUnit(event.currentTarget.value as "cm" | "in")}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </label>
      </div>
      {fit ? (
        <>
          <div className="fit-stats">
            <span>
              <small>Flat wrist width</small>
              <strong>{fit.wristFlatWidthMm.toFixed(1)} mm</strong>
            </span>
            <span>
              <small>Fit ratio</small>
              <strong>{fit.ratio.toFixed(2)}</strong>
            </span>
          </div>
          <div className="fit-scale" aria-label={`Fit ratio ${fit.ratio.toFixed(2)}`}>
            <span style={{ left: `${ratioPosition}%` }} />
          </div>
          <div className="fit-scale-labels">
            <span>Too small</span>
            <span>Ideal</span>
            <span>Large</span>
            <span>Too large</span>
          </div>
          <div className={`fit-verdict ${fit.category}`}>
            <strong>{fit.label}</strong>
            <p>{fit.guidance}</p>
          </div>
        </>
      ) : (
        <p className="small">Enter a wrist circumference to estimate the fit.</p>
      )}
    </section>
  );
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
  const [filtersOpen, setFiltersOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 620px)").matches;
  });
  const [filters, setFilters] = useState<DimensionFilters>(() => createEmptyDimensionFilters());
  const [unit, setUnit] = useState<Unit>("mm");
  const [sort, setSort] = useState<SortKey>("lug-asc");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("dimensions");
  const [savedIds, setSavedIds] = useState<number[]>(() => readStoredIds(SAVED_STORAGE_KEY));
  const [compareIds, setCompareIds] = useState<number[]>(() => readStoredIds(COMPARE_STORAGE_KEY));
  const deferredQuery = useDeferredValue(query);
  const normalized = normalizeSearch(deferredQuery);
  const compactReferenceQuery = getCompactReferenceSearchText(deferredQuery);
  const isPending = query !== deferredQuery;
  const hasActiveFilters = hasActiveDimensionFilters(filters);
  const shouldShowFilteredState = Boolean(normalized || hasActiveFilters);

  const groupedWatches = useMemo(() => groupWatchesForDisplay(watches, deferredQuery), [deferredQuery, watches]);
  const filtered = useMemo(() => {
    const dimensionFiltered = filterWatchesByDimensions(groupedWatches, filters);
    const searched = normalized
      ? dimensionFiltered.filter((watch) => (
          watch.groupSearchText.includes(normalized) ||
          (compactReferenceQuery.length > 0 && watch.groupCompactReferenceSearchText.includes(compactReferenceQuery))
        ))
      : dimensionFiltered;
    return sortWatches(searched, sort);
  }, [compactReferenceQuery, filters, groupedWatches, normalized, sort]);

  const results = filtered.slice(0, 80);
  const selected = filtered.find((watch) => watch.id === selectedId) ?? filtered[0] ?? null;
  const compareWatches = compareIds
    .map((id) => groupedWatches.find((watch) => watch.id === id))
    .filter((watch): watch is WatchDisplayGroup => Boolean(watch));

  useEffect(() => {
    const recentSection = document.querySelector<HTMLElement>("[data-recent-watches]");
    if (!recentSection) return;
    recentSection.hidden = shouldShowFilteredState;
    return () => {
      recentSection.hidden = false;
    };
  }, [shouldShowFilteredState]);

  useEffect(() => {
    writeStoredIds(SAVED_STORAGE_KEY, savedIds);
    window.dispatchEvent(new Event("lugtolug:saved-change"));
  }, [savedIds]);

  useEffect(() => {
    writeStoredIds(COMPARE_STORAGE_KEY, compareIds);
  }, [compareIds]);

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

  function toggleSaved(id: number) {
    setSavedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleCompare(id: number) {
    setCompareIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id].slice(-4);
    });
  }

  function chooseWatch(watch: WatchDisplayGroup) {
    setSelectedId(watch.id);
    setDetailTab("dimensions");
  }

  return (
    <section className="database-workbench" aria-label="Lug to Lug Finder database">
      <div className="workbench-head">
        <div>
          <p className="eyebrow">Search</p>
          <h1>Find the watch size that actually wears right.</h1>
          <p>Search watches, references, or dimensions in one box to compare lug-to-lug, case, thickness, lug width, source confidence, and wrist fit.</p>
        </div>
        <div className="status-strip" aria-label="Database status">
          <span>{groupedWatches.length.toLocaleString()} records</span>
          <span>{savedIds.length} saved</span>
          <span>{compareIds.length} compare</span>
        </div>
      </div>

      <div className="database-controls">
        <form className="search-grid" role="search" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>Search watches, references, or dimensions</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                aria-label="Search watches by name, reference, or dimensions"
                placeholder="e.g., Omega Speedmaster, 310.30, or 47.5"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>
          </label>
          <button className="button accent" type="submit">Search</button>
          <button className="button secondary" type="button" onClick={resetFilters}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset
          </button>
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

      <div className="database-layout">
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
          <div className="database-table" role="table" aria-label="Watch results">
            <div className="database-row database-row-head" role="row">
              <span>Brand / model</span>
              <span>Lug to lug</span>
              <span>Case</span>
              <span>Thickness</span>
              <span>Lug width</span>
              <span>Source</span>
              <span>Conf.</span>
              <span>Actions</span>
            </div>
            {results.map((watch) => {
              const isSelected = selected?.id === watch.id;
              const isSaved = savedIds.includes(watch.id);
              const isCompared = compareIds.includes(watch.id);
              return (
                <article
                  className={`database-row${isSelected ? " selected" : ""}`}
                  key={watch.id}
                  role="row"
                  tabIndex={0}
                  onClick={() => chooseWatch(watch)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") chooseWatch(watch);
                  }}
                >
                  <span className="row-name">
                    <strong>{[watch.brand, watch.model].filter(Boolean).join(" ")}</strong>
                    <small>
                      {watch.reference || "Reference not provided"}
                      {watch.variantCount > 1 ? ` · ${watch.variantCount} references` : ""}
                    </small>
                  </span>
                  <span className="row-primary-metric">
                    <strong>{compactDimension(watch.lugToLugMm, unit)}</strong>
                    <small>{unit}</small>
                  </span>
                  <span>{formatDimension(watch.caseMm, unit)}</span>
                  <span>{formatDimension(watch.thicknessMm, unit)}</span>
                  <span>{formatDimension(watch.lugWidthMm, unit)}</span>
                  <span>{sourceLabel(watch)}</span>
                  <span><ConfidenceDots confidence={watch.confidence} /></span>
                  <span className="row-actions">
                    <button
                      type="button"
                      className={isCompared ? "icon-button active" : "icon-button"}
                      aria-label={isCompared ? "Remove from compare" : "Add to compare"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleCompare(watch.id);
                      }}
                    >
                      <GitCompareArrows size={15} aria-hidden="true" />
                    </button>
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
            <p className="empty-state">No matching watches yet. Submit a source and the operator can review it.</p>
          )}
          {filtered.length > results.length && <p className="small">Showing first {results.length} results. Narrow the search to inspect more records.</p>}
        </section>

        <aside className="detail-panel" aria-label="Selected watch detail">
          {selected ? (
            <>
              <div className="detail-panel-head">
                <div>
                  <p className="eyebrow">Selected watch</p>
                  <h2>{[selected.brand, selected.model].filter(Boolean).join(" ")}</h2>
                  <p>{selected.reference || "Reference not provided"}</p>
                </div>
                <button className="icon-button" type="button" aria-label="Clear selected watch" onClick={() => setSelectedId(null)}>
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="detail-tabs" role="tablist" aria-label="Watch detail sections">
                {(["dimensions", "specs", "sources", "notes"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={detailTab === tab}
                    className={detailTab === tab ? "active" : ""}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {detailTab === "dimensions" && (
                <div className="detail-tab-panel" role="tabpanel">
                  <WatchDiagram watch={selected} unit={unit} />
                  <FitAnalyzer lugToLugMm={selected.lugToLugMm} />
                </div>
              )}

              {detailTab === "specs" && (
                <div className="detail-tab-panel spec-list" role="tabpanel">
                  {WATCH_METRICS.map((metric) => (
                    <span key={metric.key}>
                      <small>{metric.detailLabel}</small>
                      <strong>{formatDimension(selected[metric.key], unit)}</strong>
                    </span>
                  ))}
                  <span>
                    <small>Confidence</small>
                    <strong>{selected.confidence}</strong>
                  </span>
                </div>
              )}

              {detailTab === "sources" && (
                <div className="detail-tab-panel source-list" role="tabpanel">
                  {selected.sources.length > 0 ? selected.sources.map((source) => (
                    <a href={source.sourceUrl} key={source.id} target="_blank" rel="noreferrer">
                      {sourceLabel(selected)}
                      {source.note && <small>{source.note}</small>}
                    </a>
                  )) : <p className="small">No sources attached.</p>}
                </div>
              )}

              {detailTab === "notes" && (
                <div className="detail-tab-panel" role="tabpanel">
                  <p className="small">Measurements may vary by reference. Verify the source before purchase.</p>
                  <a className="button secondary" href={getWatchHref(selected)}>Open full record</a>
                </div>
              )}
            </>
          ) : (
            <p className="empty-state">Select a watch to inspect dimensions and fit guidance.</p>
          )}
        </aside>
      </div>

      {compareWatches.length >= 2 && (
        <section className="compare-tray" aria-label="Compare queue">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Compare ({compareWatches.length})</p>
              <h3>Dimension queue</h3>
            </div>
            <button className="button secondary" type="button" onClick={() => setCompareIds([])}>Clear</button>
          </div>
          <div className="compare-grid">
            {compareWatches.map((watch) => (
              <article key={watch.id}>
                <button className="icon-button" type="button" aria-label="Remove from compare" onClick={() => toggleCompare(watch.id)}>
                  <X size={15} aria-hidden="true" />
                </button>
                <strong>{watch.brand} {watch.model}</strong>
                <small>{watch.reference}</small>
                <dl>
                  {WATCH_METRICS.map((metric) => (
                    <div key={metric.key}>
                      <dt>{metric.rowLabel}</dt>
                      <dd>{formatDimension(watch[metric.key], unit)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

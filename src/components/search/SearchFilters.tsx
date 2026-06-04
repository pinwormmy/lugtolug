import { Search, SlidersHorizontal } from "lucide-react";
import { WATCH_METRICS } from "@/lib/watch";
import type { DimensionFilters, DimensionKey } from "@/lib/watchFilters";

interface Props {
  query: string;
  showFilters: boolean;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  dimensionFilters: DimensionFilters;
  onQueryChange: (query: string) => void;
  onToggle: () => void;
  onClear: () => void;
  onUpdate: (metricKey: DimensionKey, bound: "min" | "max", value: string) => void;
}

export default function SearchFilters({
  query,
  showFilters,
  hasActiveFilters,
  activeFilterCount,
  dimensionFilters,
  onQueryChange,
  onToggle,
  onClear,
  onUpdate
}: Props) {
  return (
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
              onChange={(event) => onQueryChange(event.currentTarget.value)}
            />
          </div>
        </label>

        <div className="search-panel-actions">
          <button
            className={`button secondary search-filter-toggle${showFilters ? " active" : ""}`}
            type="button"
            aria-expanded={showFilters}
            aria-controls="search-filters-panel"
            onClick={onToggle}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 && <span className="filter-pill">{activeFilterCount}</span>}
          </button>

          {hasActiveFilters && (
            <button className="button secondary reset-button" type="button" onClick={onClear}>
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
                      onChange={(event) => onUpdate(metric.key, "min", event.currentTarget.value)}
                    />
                  </label>
                  <label>
                    <span>Max</span>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="Any"
                      value={dimensionFilters[metric.key].max}
                      onChange={(event) => onUpdate(metric.key, "max", event.currentTarget.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

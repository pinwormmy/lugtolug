import type { WatchWithSources } from "@/types";

export type DimensionKey = "lugToLugMm" | "caseMm" | "thicknessMm" | "lugWidthMm";

export interface DimensionFilter {
  min: string;
  max: string;
}

export type DimensionFilters = Record<DimensionKey, DimensionFilter>;

export const DIMENSION_KEYS: DimensionKey[] = ["lugToLugMm", "caseMm", "thicknessMm", "lugWidthMm"];

export function createEmptyDimensionFilters(): DimensionFilters {
  return {
    lugToLugMm: { min: "", max: "" },
    caseMm: { min: "", max: "" },
    thicknessMm: { min: "", max: "" },
    lugWidthMm: { min: "", max: "" }
  };
}

function parseBound(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesBound(value: number | null, filter: DimensionFilter): boolean {
  const min = parseBound(filter.min);
  const max = parseBound(filter.max);
  if (min == null && max == null) return true;
  if (value == null) return false;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function hasActiveDimensionFilters(filters: DimensionFilters): boolean {
  return DIMENSION_KEYS.some((key) => {
    const filter = filters[key];
    return Boolean(filter.min.trim() || filter.max.trim());
  });
}

export function watchMatchesDimensionFilters(
  watch: Pick<WatchWithSources, DimensionKey>,
  filters: DimensionFilters
): boolean {
  return DIMENSION_KEYS.every((key) => matchesBound(watch[key], filters[key]));
}

export function filterWatchesByDimensions<T extends Pick<WatchWithSources, DimensionKey>>(
  watches: T[],
  filters: DimensionFilters
): T[] {
  return watches.filter((watch) => watchMatchesDimensionFilters(watch, filters));
}

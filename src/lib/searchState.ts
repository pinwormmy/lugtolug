import { createEmptyDimensionFilters, DIMENSION_KEYS, type DimensionFilters } from "@/lib/watchFilters";

export type WatchSortKey = "recent" | "lug-asc" | "lug-desc";

export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_SORT_PARAM = "sort";

export interface SearchState {
  query: string;
  sort: WatchSortKey;
  dimensionFilters: DimensionFilters;
}

const DEFAULT_SORT: WatchSortKey = "recent";

function getDimensionParamName(key: string, bound: "min" | "max"): string {
  return `${key}${bound === "min" ? "Min" : "Max"}`;
}

function isWatchSortKey(value: string | null): value is WatchSortKey {
  return value === "recent" || value === "lug-asc" || value === "lug-desc";
}

export function readSearchState(searchParams: URLSearchParams): SearchState {
  const dimensionFilters = createEmptyDimensionFilters();
  const sortParam = searchParams.get(SEARCH_SORT_PARAM);

  for (const key of DIMENSION_KEYS) {
    const minValue = searchParams.get(getDimensionParamName(key, "min"));
    const maxValue = searchParams.get(getDimensionParamName(key, "max"));

    if (minValue != null) dimensionFilters[key].min = minValue;
    if (maxValue != null) dimensionFilters[key].max = maxValue;
  }

  return {
    query: searchParams.get(SEARCH_QUERY_PARAM) ?? "",
    sort: isWatchSortKey(sortParam) ? sortParam : DEFAULT_SORT,
    dimensionFilters
  };
}

export function buildSearchUrl(
  locationLike: Pick<Location, "pathname" | "search" | "hash">,
  state: SearchState
): string {
  const url = new URL(locationLike.pathname + locationLike.search + locationLike.hash, "http://localhost");

  const trimmedQuery = state.query.trim();
  if (trimmedQuery.length > 0) {
    url.searchParams.set(SEARCH_QUERY_PARAM, state.query);
  } else {
    url.searchParams.delete(SEARCH_QUERY_PARAM);
  }

  if (state.sort !== DEFAULT_SORT) {
    url.searchParams.set(SEARCH_SORT_PARAM, state.sort);
  } else {
    url.searchParams.delete(SEARCH_SORT_PARAM);
  }

  for (const key of DIMENSION_KEYS) {
    const filter = state.dimensionFilters[key];
    for (const bound of ["min", "max"] as const) {
      const paramName = getDimensionParamName(key, bound);
      const value = filter[bound].trim();
      if (value.length > 0) {
        url.searchParams.set(paramName, filter[bound]);
      } else {
        url.searchParams.delete(paramName);
      }
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

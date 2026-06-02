import type { Watch } from "@/types";
import { normalizeSearch } from "@/lib/slug";

export const WATCH_METRICS = [
  {
    key: "lugToLugMm",
    rowLabel: "Lug-to-lug",
    detailLabel: "Lug-to-lug"
  },
  {
    key: "caseMm",
    rowLabel: "Case",
    detailLabel: "Case"
  },
  {
    key: "thicknessMm",
    rowLabel: "Thickness",
    detailLabel: "Thickness"
  },
  {
    key: "lugWidthMm",
    rowLabel: "Lug width",
    detailLabel: "Lug width"
  }
] as const satisfies readonly {
  key: keyof Pick<Watch, "lugToLugMm" | "caseMm" | "thicknessMm" | "lugWidthMm">;
  rowLabel: string;
  detailLabel: string;
}[];

export type WatchMetric = (typeof WATCH_METRICS)[number];

export function getWatchHref(watch: Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">): string {
  return `/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

export function getWatchSearchText(
  watch: Pick<Watch, "brand" | "model" | "reference"> & Partial<Pick<Watch, "lugToLugMm" | "caseMm" | "thicknessMm" | "lugWidthMm">>
): string {
  const metricText = WATCH_METRICS.flatMap((metric) => {
    const value = watch[metric.key];
    return value == null ? [] : [metric.rowLabel, String(value), `${value}mm`];
  }).join(" ");

  return normalizeSearch(`${watch.brand} ${watch.model} ${watch.reference} ${metricText}`);
}

export function getSearchTokens(query: string): string[] {
  return normalizeSearch(query).split(" ").filter(Boolean);
}

export function searchTextMatchesQuery(searchText: string, query: string): boolean {
  const tokens = getSearchTokens(query);
  if (tokens.length === 0) return false;

  const normalizedSearchText = normalizeSearch(searchText);
  return tokens.every((token) => normalizedSearchText.includes(token));
}

export function watchMatchesSearchQuery(watch: Pick<Watch, "brand" | "model" | "reference">, query: string): boolean {
  return searchTextMatchesQuery(getWatchSearchText(watch), query);
}

export function formatMm(value: number | null | undefined): string {
  if (value == null) return "Not provided";
  return `${value} mm`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

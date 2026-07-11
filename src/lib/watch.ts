import type { Watch } from "@/types";
import { normalizeSearch, normalizeSearchWithAliases } from "@/lib/slug";
import brandSearchAliases from "../../data/brand-search-aliases.json";

const BRAND_SEARCH_ALIASES: Record<string, string[]> = brandSearchAliases;

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

function caseSizePattern(caseMm: number): RegExp {
  const [whole, fraction] = String(caseMm).split(".");
  // Match the case size already written in the name ("40", "40mm", "38.5", "44,25", "44 25 mm"),
  // without treating the "40" in "40.5" or "1940" as a match for a 40 mm case.
  const body = fraction ? `${whole}[.,\\s]?${fraction}` : `${whole}(?![.,]\\d)`;
  return new RegExp(`\\b${body}(\\s?mm)?\\b`);
}

export function getWatchDisplayModel(watch: Pick<Watch, "model" | "canonicalModel" | "caseMm">): string {
  const name = watch.canonicalModel || watch.model;
  if (watch.caseMm == null || caseSizePattern(watch.caseMm).test(name)) return name;
  return `${name} ${watch.caseMm}mm`;
}

export function getWatchDisplayName(watch: Pick<Watch, "brand" | "model" | "canonicalModel" | "caseMm">): string {
  return [watch.brand, getWatchDisplayModel(watch)].filter(Boolean).join(" ");
}

export function getWatchSearchText(
  watch: Pick<Watch, "brand" | "model" | "reference"> &
    Partial<Pick<Watch, "canonicalModel" | "modelGroup" | "variant" | "lugToLugMm" | "caseMm" | "thicknessMm" | "lugWidthMm">>
): string {
  const metricText = WATCH_METRICS.flatMap((metric) => {
    const value = watch[metric.key];
    return value == null ? [] : [metric.rowLabel, String(value), `${value}mm`];
  }).join(" ");

  return normalizeSearchWithAliases(
    `${watch.brand} ${(BRAND_SEARCH_ALIASES[watch.brand] ?? []).join(" ")} ${watch.model} ${watch.canonicalModel ?? ""} ${watch.modelGroup ?? ""} ${watch.variant ?? ""} ${watch.reference} ${metricText}`
  );
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

export function watchMatchesSearchQuery(
  watch: Pick<Watch, "brand" | "model" | "reference"> & Partial<Pick<Watch, "canonicalModel" | "modelGroup" | "variant">>,
  query: string
): boolean {
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

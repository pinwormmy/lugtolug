import type { Watch } from "@/types";
import { normalizeSearch } from "@/lib/slug";

export const WATCH_METRICS = [
  {
    key: "lugToLugMm",
    rowLabel: "Lug-to-lug",
    detailLabel: "Lug-to-lug"
  },
  {
    key: "diameterMm",
    rowLabel: "Diameter",
    detailLabel: "Case diameter"
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
  key: keyof Pick<Watch, "lugToLugMm" | "diameterMm" | "thicknessMm" | "lugWidthMm">;
  rowLabel: string;
  detailLabel: string;
}[];

export type WatchMetric = (typeof WATCH_METRICS)[number];

export function getWatchHref(watch: Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">): string {
  return `/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

export function getWatchSearchText(watch: Pick<Watch, "brand" | "model" | "reference">): string {
  return normalizeSearch(`${watch.brand} ${watch.model} ${watch.reference}`);
}

export function formatMm(value: number): string {
  return `${value} mm`;
}

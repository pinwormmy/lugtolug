import type { WatchWithSources } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { getWatchSearchText } from "@/lib/watch";

export interface WatchDisplayGroup extends WatchWithSources {
  variantCount: number;
  variants: WatchWithSources[];
  variantReferences: string[];
  groupSearchText: string;
  groupCompactReferenceSearchText: string;
}

function metricKey(value: number | null | undefined): string {
  return value == null ? "null" : Number(value).toFixed(1);
}

function getDisplayGroupKey(watch: WatchWithSources): string {
  const modelKey = watch.modelGroup || watch.modelSlug;
  return [
    watch.brandSlug,
    modelKey,
    metricKey(watch.lugToLugMm),
    metricKey(watch.caseMm),
    metricKey(watch.thicknessMm),
    metricKey(watch.lugWidthMm)
  ].join("|");
}

export function getCompactReferenceSearchText(reference: string): string {
  return reference.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

export function shouldUseCompactReferenceSearch(query: string): boolean {
  return /\d/.test(query) && query.length >= 3;
}

function getVariantSearchText(watch: WatchWithSources): string {
  return [getWatchSearchText(watch), getCompactReferenceSearchText(watch.reference)].filter(Boolean).join(" ");
}

function pickRepresentative(variants: WatchWithSources[], normalizedQuery: string): WatchWithSources {
  if (!normalizedQuery) return variants[0];

  const referenceMatch = variants.find((watch) => {
    const referenceText = normalizeSearch(watch.reference);
    const compactReferenceText = getCompactReferenceSearchText(watch.reference);
    return referenceText.includes(normalizedQuery) || compactReferenceText.includes(normalizedQuery);
  });
  return referenceMatch ?? variants[0];
}

export function groupWatchesForDisplay(watches: WatchWithSources[], query = ""): WatchDisplayGroup[] {
  const normalizedQuery = normalizeSearch(query);
  const grouped = new Map<string, WatchWithSources[]>();

  for (const watch of watches) {
    const key = getDisplayGroupKey(watch);
    const current = grouped.get(key);
    if (current) {
      current.push(watch);
    } else {
      grouped.set(key, [watch]);
    }
  }

  return [...grouped.values()].map((variants) => {
    const representative = pickRepresentative(variants, normalizedQuery);
    const variantReferences = variants.map((watch) => watch.reference).filter(Boolean);
    const groupSearchText = variants.map(getVariantSearchText).join(" ");
    const groupCompactReferenceSearchText = variantReferences.map(getCompactReferenceSearchText).join(" ");

    return {
      ...representative,
      variantCount: variants.length,
      variants,
      variantReferences,
      groupSearchText,
      groupCompactReferenceSearchText
    };
  });
}

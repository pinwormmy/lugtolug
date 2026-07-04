import type { Watch } from "@/types";
import { normalizeSearch } from "@/lib/slug";
import { getWatchSearchText } from "@/lib/watch";
import { compactReference } from "@/lib/watchIdentity";

// Query-independent grouping data: computed once per dataset, reused across keystrokes.
export interface WatchGroup {
  variantCount: number;
  variants: Watch[];
  variantReferences: string[];
  groupSearchText: string;
  groupCompactReferenceSearchText: string;
}

export interface WatchDisplayGroup extends Watch, WatchGroup {}

function metricKey(value: number | null | undefined): string {
  return value == null ? "null" : Number(value).toFixed(1);
}

function getDisplayGroupKey(watch: Watch): string {
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
  return compactReference(reference).toLowerCase();
}

export function shouldUseCompactReferenceSearch(query: string): boolean {
  return /\d/.test(query) && query.length >= 3;
}

function getVariantSearchText(watch: Watch): string {
  return [getWatchSearchText(watch), getCompactReferenceSearchText(watch.reference)].filter(Boolean).join(" ");
}

function pickRepresentative(variants: Watch[], normalizedQuery: string): Watch {
  if (!normalizedQuery) return variants[0];

  const referenceMatch = variants.find((watch) => {
    const referenceText = normalizeSearch(watch.reference);
    const compactReferenceText = getCompactReferenceSearchText(watch.reference);
    return referenceText.includes(normalizedQuery) || compactReferenceText.includes(normalizedQuery);
  });
  return referenceMatch ?? variants[0];
}

// Build the query-independent group structure. This does the heavy per-record search
// text normalization, so it should be memoized on the dataset and reused across queries.
export function buildWatchGroups(watches: Watch[]): WatchGroup[] {
  const grouped = new Map<string, Watch[]>();

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
    const variantReferences = variants.map((watch) => watch.reference).filter(Boolean);
    const groupSearchText = variants.map(getVariantSearchText).join(" ");
    const groupCompactReferenceSearchText = variantReferences.map(getCompactReferenceSearchText).join(" ");

    return {
      variantCount: variants.length,
      variants,
      variantReferences,
      groupSearchText,
      groupCompactReferenceSearchText
    };
  });
}

// Resolve which variant represents each group for the current query. Cheap enough to
// re-run per keystroke because the group structure and search text are already built.
export function resolveDisplayGroups(groups: WatchGroup[], query = ""): WatchDisplayGroup[] {
  const normalizedQuery = normalizeSearch(query);
  return groups.map((group) => ({
    ...pickRepresentative(group.variants, normalizedQuery),
    ...group
  }));
}

export function groupWatchesForDisplay(watches: Watch[], query = ""): WatchDisplayGroup[] {
  return resolveDisplayGroups(buildWatchGroups(watches), query);
}

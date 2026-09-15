import type { Watch } from "@/types";

// Single source of truth for the text normalization shared by the app and the
// node data scripts (scripts/generate-seed-sql.mjs, scripts/watch-duplicate-candidates.mjs).
// The scripts import this file directly under Node's TypeScript type stripping,
// so keep it free of value imports and non-erasable syntax (no enums/namespaces).

// Letters that NFKD does not decompose into an ASCII base letter.
const SLUG_LETTER_REPLACEMENTS: Record<string, string> = {
  "ß": "ss",
  "æ": "ae",
  "œ": "oe",
  "ø": "o",
  "ł": "l",
  "đ": "d",
  "ð": "d",
  "þ": "th",
  "×": " x "
};

/**
 * URL slug for a brand, model, or reference. Accented Latin letters transliterate
 * to their base letter (Glashütte Original -> glashutte-original, Hermès -> hermes)
 * so the URL keeps the brand name readable and searchable; everything that is
 * not a Latin letter or digit becomes a hyphen. `legacySlugify` keeps the old
 * output so previously indexed URLs can redirect.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[ßæœøłđðþ×]/g, (letter) => SLUG_LETTER_REPLACEMENTS[letter] ?? letter)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The slug rule used before transliteration; only for redirecting old URLs. */
export function legacySlugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transliterateGermanSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function normalizeSearchWithAliases(value: string): string {
  const normalized = normalizeSearch(value);
  const germanTransliterated = normalizeSearch(transliterateGermanSearch(value));

  return [normalized, germanTransliterated]
    .filter((part, index, parts) => part.length > 0 && parts.indexOf(part) === index)
    .join(" ");
}

export function compactReference(reference: string): string {
  return reference.replace(/[^a-z0-9]+/gi, "").toUpperCase();
}

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

export interface SearchTextWatch {
  brand: string;
  model: string;
  reference: string;
  canonicalModel?: string | null;
  modelGroup?: string | null;
  variant?: string | null;
  lugToLugMm?: number | null;
  caseMm?: number | null;
  thicknessMm?: number | null;
  lugWidthMm?: number | null;
}

export interface WatchSlugs {
  brandSlug: string;
  modelSlug: string;
  referenceSlug: string;
}

export function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Runtime search and the generated D1 search_text column must stay identical,
// so both go through this builder.
export function buildWatchSearchText(watch: SearchTextWatch, brandAliases: Record<string, string[]>): string {
  const metricText = WATCH_METRICS.flatMap((metric) => {
    const value = watch[metric.key];
    return value == null ? [] : [metric.rowLabel, String(value), `${value}mm`];
  }).join(" ");

  return normalizeSearchWithAliases(
    `${watch.brand} ${(brandAliases[watch.brand] ?? []).join(" ")} ${watch.model} ${watch.canonicalModel ?? ""} ${watch.modelGroup ?? ""} ${watch.variant ?? ""} ${watch.reference} ${metricText}`
  );
}

// Korean-only model names slugify to ""; fall back to the reference slug so
// detail URLs stay routable (see commit 08a0da2).
export function getWatchModelSlug(watch: Pick<SearchTextWatch, "model" | "reference">): string {
  return slugify(watch.model) || slugify(watch.reference);
}

// Runtime seed records, generated D1 rows, and admin mutations must resolve to
// the same URL. The fallbacks also keep incomplete user submissions routable.
export function getWatchSlugs(
  watch: Pick<SearchTextWatch, "brand" | "model" | "reference">
): WatchSlugs {
  return {
    brandSlug: slugify(watch.brand) || "unknown-brand",
    modelSlug: getWatchModelSlug(watch) || "watch",
    referenceSlug: slugify(watch.reference) || "no-reference"
  };
}

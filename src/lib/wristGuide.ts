import type { Watch } from "@/types";
import {
  FIT_RATIO_STANDARD,
  FIT_RATIO_THRESHOLDS,
  WRIST_FLAT_WIDTH_RATIO,
  flatWristWidthFromCircumference,
  inchesToMm,
  mmToInches
} from "@/lib/fit";

// Static, indexable "what fits my wrist" guides built from the seed catalog:
// one page per wrist circumference, per lug-to-lug ceiling, and per wrist ×
// genre combination for the genres that model names identify reliably.

export interface WristSize {
  slug: string;
  inches: number;
  cm: number;
  circumferenceMm: number;
  flatWidthMm: number;
  /** "6.5 inch (16.5 cm)" */
  label: string;
  /** Sizes small enough that "small wrist" phrasing applies. */
  small: boolean;
}

export type LugToLugCollectionKind = "ceiling" | "range" | "floor";

/** A lug-to-lug bucket: `minMm` inclusive, `maxMm` exclusive, either may be open. */
export interface LugToLugCollection {
  slug: string;
  kind: LugToLugCollectionKind;
  minMm: number | null;
  maxMm: number | null;
  /** "Under 44 mm lug-to-lug", "45–48 mm lug-to-lug", "Over 51 mm lug-to-lug" */
  label: string;
  /** "under 44 mm", "45 to 48 mm", "over 51 mm" — for prose. */
  rangeLabel: string;
  /** Which wrists the bucket's sweet spot serves. */
  wristHint: string;
  /** The span used when the bucket is reduced to one number (e.g. wrist fit tables). */
  representativeMm: number;
}

/** @deprecated kept for readability at call sites; same shape as LugToLugCollection. */
export type LugToLugLimit = LugToLugCollection;

export interface WatchGenre {
  slug: string;
  /** Plural, e.g. "Dive watches". */
  name: string;
  /** Singular, lower case, e.g. "dive watch". */
  singular: string;
  pattern: RegExp;
  exclude?: RegExp;
}

export interface WristFitBands {
  flatWidthMm: number;
  sweetSpotMm: number;
  compactMaxMm: number;
  balancedMaxMm: number;
  largeMaxMm: number;
  borderlineMaxMm: number;
}

export type WristFitBand = "compact" | "balanced" | "large" | "borderline" | "overhang";

export interface BrandCount {
  brand: string;
  brandSlug: string;
  count: number;
}

export interface WristGuide {
  size: WristSize;
  genre: WatchGenre | null;
  bands: WristFitBands;
  /** Balanced-band watches, closest to the sweet spot first. */
  balanced: Watch[];
  /** Compact-band watches, closest to balanced first. */
  compact: Watch[];
  /** Large-band watches, closest to balanced first. */
  large: Watch[];
  counts: Record<WristFitBand, number> & { total: number };
  /** Brands with the most balanced-band watches. */
  topBrands: BrandCount[];
  /** Balanced-band counts per genre, for the genre navigation. */
  genreCounts: Array<{ genre: WatchGenre; count: number }>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function wristSize(inches: number): WristSize {
  const circumferenceMm = inchesToMm(inches);
  const cm = round1(circumferenceMm / 10);
  return {
    slug: `${String(inches).replace(".", "-")}-inch`,
    inches,
    cm,
    circumferenceMm,
    flatWidthMm: flatWristWidthFromCircumference(circumferenceMm),
    label: `${inches} inch (${cm} cm)`,
    small: inches <= 6
  };
}

export const WRIST_SIZES: WristSize[] = [5.5, 6, 6.5, 7, 7.5, 8].map(wristSize);

/** Wrist circumference whose fit sweet spot (ratio 0.8 of flat width) is this span. */
function sweetSpotWristInches(lugToLugMm: number): number {
  return mmToInches(lugToLugMm / (FIT_RATIO_STANDARD * WRIST_FLAT_WIDTH_RATIO));
}

function wristHintFor(minMm: number | null, maxMm: number | null): string {
  const inches = (mm: number) => sweetSpotWristInches(mm).toFixed(1);
  const cm = (mm: number) => (inchesToMm(sweetSpotWristInches(mm)) / 10).toFixed(1);
  if (minMm == null && maxMm != null) return `Sweet spot for wrists up to ${inches(maxMm)} in (${cm(maxMm)} cm).`;
  if (minMm != null && maxMm == null) return `Sweet spot for wrists from ${inches(minMm)} in (${cm(minMm)} cm).`;
  if (minMm != null && maxMm != null) return `Sweet spot for ${inches(minMm)}–${inches(maxMm)} in wrists (${cm(minMm)}–${cm(maxMm)} cm).`;
  return "";
}

function lugToLugCollection(minMm: number | null, maxMm: number | null): LugToLugCollection {
  if (minMm == null && maxMm != null) {
    return {
      slug: `under-${maxMm}mm`,
      kind: "ceiling",
      minMm,
      maxMm,
      label: `Under ${maxMm} mm lug-to-lug`,
      rangeLabel: `under ${maxMm} mm`,
      wristHint: wristHintFor(minMm, maxMm),
      representativeMm: maxMm
    };
  }
  if (minMm != null && maxMm == null) {
    return {
      slug: `over-${minMm}mm`,
      kind: "floor",
      minMm,
      maxMm,
      label: `Over ${minMm} mm lug-to-lug`,
      rangeLabel: `over ${minMm} mm`,
      wristHint: wristHintFor(minMm, maxMm),
      representativeMm: minMm
    };
  }
  if (minMm == null || maxMm == null) throw new Error("A lug-to-lug collection needs at least one bound.");
  return {
    slug: `${minMm}-${maxMm}mm`,
    kind: "range",
    minMm,
    maxMm,
    label: `${minMm}–${maxMm} mm lug-to-lug`,
    rangeLabel: `${minMm} to ${maxMm} mm`,
    wristHint: wristHintFor(minMm, maxMm),
    representativeMm: round1((minMm + maxMm) / 2)
  };
}

/** Cumulative "under X" ceilings: the thresholds people search for. */
export const LUG_TO_LUG_LIMITS: LugToLugCollection[] = [40, 42, 44, 46, 48].map((maxMm) => lugToLugCollection(null, maxMm));

/** Non-overlapping practical buckets for browsing, each roughly one wrist size. */
export const LUG_TO_LUG_RANGES: LugToLugCollection[] = [
  LUG_TO_LUG_LIMITS.find((limit) => limit.maxMm === 42)!,
  lugToLugCollection(42, 45),
  lugToLugCollection(45, 48),
  lugToLugCollection(48, 51),
  lugToLugCollection(51, null)
];

export const LUG_TO_LUG_COLLECTIONS: LugToLugCollection[] = [
  ...LUG_TO_LUG_LIMITS,
  ...LUG_TO_LUG_RANGES.filter((range) => range.kind !== "ceiling")
];

export function matchesLugToLug(watch: Pick<Watch, "lugToLugMm">, collection: LugToLugCollection): boolean {
  return (
    (collection.minMm == null || watch.lugToLugMm >= collection.minMm) &&
    (collection.maxMm == null || watch.lugToLugMm < collection.maxMm)
  );
}

// Conservative name-based matchers: a miss only drops a watch from a genre page,
// while a false match puts a three-hander on a "chronographs" page.
export const WATCH_GENRES: WatchGenre[] = [
  {
    slug: "dive-watches",
    name: "Dive watches",
    singular: "dive watch",
    pattern:
      /\b(diver|dive|submariner|sea-?dweller|deepsea|fifty fathoms|pelagos|planet ocean|seamaster (300|diver)|aquis|superocean|seastar|scuba|marinemaster|turtle|samurai|monster|skx|willard|captain cook|bathyscaphe)\b/i,
    exclude: /aqua terra/i
  },
  {
    slug: "chronographs",
    name: "Chronographs",
    singular: "chronograph",
    pattern: /\b(chrono|chronograph|speedmaster|daytona|navitimer|el primero|speedtimer|monopusher|rattrapante)\b/i
  },
  {
    slug: "gmt-watches",
    name: "GMT and travel watches",
    singular: "GMT watch",
    pattern: /\b(gmt|world ?timer?|dual ?time|travel ?time|explorer ii)\b/i
  }
];

export function getWristSize(slug: string): WristSize | null {
  return WRIST_SIZES.find((size) => size.slug === slug) ?? null;
}

export function getLugToLugLimit(slug: string): LugToLugCollection | null {
  return LUG_TO_LUG_COLLECTIONS.find((collection) => collection.slug === slug) ?? null;
}

export function getWatchGenre(slug: string): WatchGenre | null {
  return WATCH_GENRES.find((genre) => genre.slug === slug) ?? null;
}

export function getWristGuideHref(size: WristSize, genre?: WatchGenre | null): string {
  return genre ? `/wrist/${size.slug}/${genre.slug}` : `/wrist/${size.slug}`;
}

export function getLugToLugLimitHref(limit: LugToLugCollection): string {
  return `/lug-to-lug/${limit.slug}`;
}

type GenreWatch = Pick<Watch, "model" | "canonicalModel" | "variant">;

export function matchesGenre(watch: GenreWatch, genre: WatchGenre): boolean {
  const text = [watch.model, watch.canonicalModel, watch.variant].filter(Boolean).join(" ");
  if (genre.exclude?.test(text)) return false;
  return genre.pattern.test(text);
}

export function getWristFitBands(size: WristSize): WristFitBands {
  const flat = size.flatWidthMm;
  return {
    flatWidthMm: round1(flat),
    sweetSpotMm: round1(flat * FIT_RATIO_STANDARD),
    compactMaxMm: round1(flat * FIT_RATIO_THRESHOLDS.balancedMin),
    balancedMaxMm: round1(flat * FIT_RATIO_THRESHOLDS.balancedMax),
    largeMaxMm: round1(flat * FIT_RATIO_THRESHOLDS.largeMax),
    borderlineMaxMm: round1(flat * FIT_RATIO_THRESHOLDS.borderlineMax)
  };
}

export function classifyFit(lugToLugMm: number, size: WristSize): WristFitBand {
  const ratio = lugToLugMm / size.flatWidthMm;
  if (ratio < FIT_RATIO_THRESHOLDS.balancedMin) return "compact";
  if (ratio <= FIT_RATIO_THRESHOLDS.balancedMax) return "balanced";
  if (ratio <= FIT_RATIO_THRESHOLDS.largeMax) return "large";
  if (ratio <= FIT_RATIO_THRESHOLDS.borderlineMax) return "borderline";
  return "overhang";
}

function byName(a: Watch, b: Watch): number {
  return a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.reference.localeCompare(b.reference);
}

export function countByBrand(watches: Watch[], limit = 12): BrandCount[] {
  const counts = new Map<string, BrandCount>();
  for (const watch of watches) {
    const entry = counts.get(watch.brandSlug) ?? { brand: watch.brand, brandSlug: watch.brandSlug, count: 0 };
    entry.count += 1;
    counts.set(watch.brandSlug, entry);
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
    .slice(0, limit);
}

export function buildWristGuide(watches: Watch[], size: WristSize, genre: WatchGenre | null = null): WristGuide {
  const pool = genre ? watches.filter((watch) => matchesGenre(watch, genre)) : watches;
  const bands = getWristFitBands(size);
  const sweetSpotDistance = (watch: Watch) => Math.abs(watch.lugToLugMm / size.flatWidthMm - FIT_RATIO_STANDARD);

  const counts: WristGuide["counts"] = { compact: 0, balanced: 0, large: 0, borderline: 0, overhang: 0, total: pool.length };
  const balanced: Watch[] = [];
  const compact: Watch[] = [];
  const large: Watch[] = [];
  for (const watch of pool) {
    const band = classifyFit(watch.lugToLugMm, size);
    counts[band] += 1;
    if (band === "balanced") balanced.push(watch);
    else if (band === "compact") compact.push(watch);
    else if (band === "large") large.push(watch);
  }

  balanced.sort((a, b) => sweetSpotDistance(a) - sweetSpotDistance(b) || byName(a, b));
  compact.sort((a, b) => b.lugToLugMm - a.lugToLugMm || byName(a, b));
  large.sort((a, b) => a.lugToLugMm - b.lugToLugMm || byName(a, b));

  const genreCounts = genre
    ? []
    : WATCH_GENRES.map((candidate) => ({
        genre: candidate,
        count: balanced.filter((watch) => matchesGenre(watch, candidate)).length
      })).filter((entry) => entry.count > 0);

  return {
    size,
    genre,
    bands,
    balanced,
    compact,
    large,
    counts,
    topBrands: countByBrand(balanced),
    genreCounts
  };
}

/** The smallest listed wrist on which `lugToLugMm` still reads as balanced, if any. */
export function smallestBalancedWrist(lugToLugMm: number): WristSize | null {
  return WRIST_SIZES.find((size) => classifyFit(lugToLugMm, size) === "balanced") ?? null;
}

/** The smallest listed wrist on which `lugToLugMm` already reads as compact, if any. */
export function smallestCompactWrist(lugToLugMm: number): WristSize | null {
  return WRIST_SIZES.find((size) => classifyFit(lugToLugMm, size) === "compact") ?? null;
}

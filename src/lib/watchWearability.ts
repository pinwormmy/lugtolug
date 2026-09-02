import type { Watch } from "@/types";
import { FIT_RATIO_THRESHOLDS, mmToInches } from "@/lib/fit";
import { seedWatches } from "@/lib/seed";
import { getWatchDisplayName } from "@/lib/watch";

// Plain-language "how it wears" copy for a watch, derived from the catalog
// distribution rather than fixed thresholds so it stays honest as data grows.

export type LugProportion = "compact" | "typical" | "long";
export type ThicknessClass = "slim" | "moderate" | "thick";

type CatalogWatch = Pick<Watch, "brandSlug" | "lugToLugMm" | "caseMm" | "thicknessMm">;
type WearabilityWatch = Pick<
  Watch,
  "brand" | "brandSlug" | "model" | "canonicalModel" | "caseMm" | "lugToLugMm" | "thicknessMm" | "lugWidthMm"
>;

export interface CatalogStats {
  lugToLug: number[];
  thickness: number[];
  ratioLow: number;
  ratioMedian: number;
  ratioHigh: number;
  thicknessLow: number;
  thicknessHigh: number;
  lugToLugByBrand: Map<string, number[]>;
}

export interface WearabilityProfile {
  name: string;
  brand: string;
  lugToLugMm: number;
  caseMm: number | null;
  thicknessMm: number | null;
  lugWidthMm: number | null;
  lugToCaseRatio: number | null;
  catalogMedianRatio: number;
  lugProportion: LugProportion | null;
  catalogSize: number;
  /** Percentage of the catalog with a shorter lug-to-lug than this watch. */
  longerThanShare: number;
  /** Percentage of the catalog with a longer lug-to-lug than this watch. */
  shorterThanShare: number;
  brandCount: number;
  brandLongerThanShare: number | null;
  brandShorterThanShare: number | null;
  thicknessClass: ThicknessClass | null;
  thickerThanShare: number | null;
  thinnerThanShare: number | null;
  /** Flat wrist width (mm) from which the fit reads as balanced. */
  balancedWristFromMm: number;
  /** Flat wrist width (mm) from which the fit reads as compact. */
  compactWristFromMm: number;
  /** Flat wrist width (mm) below which the lugs are likely to overhang. */
  overhangWristBelowMm: number;
}

export interface WearabilityFaq {
  question: string;
  answer: string;
}

export interface WearabilityCopy {
  headline: string;
  paragraphs: string[];
  faq: WearabilityFaq[];
}

const BRAND_CONTEXT_MIN_COUNT = 8;

function sortedNumbers(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).sort((a, b) => a - b);
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[index];
}

function countBelow(sorted: number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] < value) low = mid + 1;
    else high = mid;
  }
  return low;
}

function countAbove(sorted: number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (sorted[mid] <= value) low = mid + 1;
    else high = mid;
  }
  return sorted.length - low;
}

function share(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

export function buildCatalogStats(watches: CatalogWatch[]): CatalogStats {
  const lugToLug = sortedNumbers(watches.map((watch) => watch.lugToLugMm));
  const thickness = sortedNumbers(watches.map((watch) => watch.thicknessMm));
  const ratios = sortedNumbers(
    watches.map((watch) => (watch.caseMm ? watch.lugToLugMm / watch.caseMm : null))
  );
  const lugToLugByBrand = new Map<string, number[]>();
  for (const watch of watches) {
    const values = lugToLugByBrand.get(watch.brandSlug) ?? [];
    values.push(watch.lugToLugMm);
    lugToLugByBrand.set(watch.brandSlug, values);
  }
  for (const values of lugToLugByBrand.values()) values.sort((a, b) => a - b);

  return {
    lugToLug,
    thickness,
    ratioLow: quantile(ratios, 0.25),
    ratioMedian: quantile(ratios, 0.5),
    ratioHigh: quantile(ratios, 0.75),
    thicknessLow: quantile(thickness, 0.25),
    thicknessHigh: quantile(thickness, 0.75),
    lugToLugByBrand
  };
}

let seedStats: CatalogStats | null = null;

function getSeedStats(): CatalogStats {
  seedStats ??= buildCatalogStats(seedWatches);
  return seedStats;
}

export function buildWearabilityProfile(watch: WearabilityWatch, stats: CatalogStats = getSeedStats()): WearabilityProfile {
  const ratio = watch.caseMm ? watch.lugToLugMm / watch.caseMm : null;
  const lugProportion: LugProportion | null =
    ratio == null || Number.isNaN(stats.ratioLow)
      ? null
      : ratio <= stats.ratioLow
        ? "compact"
        : ratio >= stats.ratioHigh
          ? "long"
          : "typical";

  const brandValues = stats.lugToLugByBrand.get(watch.brandSlug) ?? [];
  const hasBrandContext = brandValues.length >= BRAND_CONTEXT_MIN_COUNT;

  const thickness = watch.thicknessMm;
  const hasThickness = thickness != null && stats.thickness.length > 0;
  const thicknessClass: ThicknessClass | null = !hasThickness
    ? null
    : thickness <= stats.thicknessLow
      ? "slim"
      : thickness >= stats.thicknessHigh
        ? "thick"
        : "moderate";

  return {
    name: getWatchDisplayName(watch),
    brand: watch.brand,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm ?? null,
    thicknessMm: thickness ?? null,
    lugWidthMm: watch.lugWidthMm ?? null,
    lugToCaseRatio: ratio,
    catalogMedianRatio: stats.ratioMedian,
    lugProportion,
    catalogSize: stats.lugToLug.length,
    longerThanShare: share(countBelow(stats.lugToLug, watch.lugToLugMm), stats.lugToLug.length),
    shorterThanShare: share(countAbove(stats.lugToLug, watch.lugToLugMm), stats.lugToLug.length),
    brandCount: brandValues.length,
    brandLongerThanShare: hasBrandContext ? share(countBelow(brandValues, watch.lugToLugMm), brandValues.length) : null,
    brandShorterThanShare: hasBrandContext ? share(countAbove(brandValues, watch.lugToLugMm), brandValues.length) : null,
    thicknessClass,
    thickerThanShare: hasThickness ? share(countBelow(stats.thickness, thickness), stats.thickness.length) : null,
    thinnerThanShare: hasThickness ? share(countAbove(stats.thickness, thickness), stats.thickness.length) : null,
    balancedWristFromMm: Math.ceil(watch.lugToLugMm / FIT_RATIO_THRESHOLDS.balancedMax),
    compactWristFromMm: Math.ceil(watch.lugToLugMm / FIT_RATIO_THRESHOLDS.balancedMin),
    overhangWristBelowMm: watch.lugToLugMm / FIT_RATIO_THRESHOLDS.borderlineMax
  };
}

function inches(value: number): string {
  return `${mmToInches(value).toFixed(2)} in`;
}

function withInches(value: number): string {
  return `${value} mm (${inches(value)})`;
}


export function buildWearabilityCopy(profile: WearabilityProfile): WearabilityCopy {
  const { name, lugToLugMm, caseMm } = profile;

  const headline =
    caseMm == null || profile.lugProportion == null
      ? `Spans ${lugToLugMm} mm lug-to-lug`
      : profile.lugProportion === "long"
        ? `Wears larger than its ${caseMm} mm case suggests`
        : profile.lugProportion === "compact"
          ? `Wears smaller than its ${caseMm} mm case suggests`
          : `Wears true to its ${caseMm} mm case size`;

  const ratioClause =
    profile.lugToCaseRatio == null
      ? ""
      : ` on a ${caseMm} mm case, a lug-to-lug ratio of ${profile.lugToCaseRatio.toFixed(2)} against a database median of ${profile.catalogMedianRatio.toFixed(2)}`;
  // Compare in one direction throughout the sentence so the brand clause reads
  // as a continuation rather than a reversal.
  const comparesLonger = profile.longerThanShare >= 50;
  const relativeSpan = (longerThanShare: number, shorterThanShare: number) =>
    comparesLonger ? `longer than ${longerThanShare}%` : `shorter than ${shorterThanShare}%`;
  const brandClause =
    profile.brandLongerThanShare == null || profile.brandShorterThanShare == null
      ? ""
      : ` and ${relativeSpan(profile.brandLongerThanShare, profile.brandShorterThanShare)} of the ${profile.brandCount} ${profile.brand} watches listed`;
  const spanParagraph =
    `${name} measures ${lugToLugMm} mm lug-to-lug${ratioClause}. ` +
    `That span is ${relativeSpan(profile.longerThanShare, profile.shorterThanShare)} of the ${profile.catalogSize.toLocaleString("en-US")} watches in this database${brandClause}.`;

  const fitParagraph =
    `A flat wrist width of ${withInches(profile.balancedWristFromMm)} or more keeps it in the balanced range, ` +
    `and from ${withInches(profile.compactWristFromMm)} it starts to look compact. ` +
    `Below ${withInches(profile.overhangWristBelowMm)} the lugs are likely to overhang the wrist. ` +
    `Flat wrist width is measured straight across the top of the wrist, not around it.`;

  const thicknessParagraph =
    profile.thicknessMm == null || profile.thicknessClass == null
      ? null
      : profile.thicknessClass === "slim"
        ? `At ${profile.thicknessMm} mm thick it is on the slim side, thinner than ${profile.thinnerThanShare}% of the watches with a listed thickness.`
        : profile.thicknessClass === "thick"
          ? `At ${profile.thicknessMm} mm thick it is on the thicker side, thicker than ${profile.thickerThanShare}% of the watches with a listed thickness.`
          : `At ${profile.thicknessMm} mm thick it sits within the typical range, thicker than ${profile.thickerThanShare}% of the watches with a listed thickness.`;

  const dimensionAnswer =
    `${withInches(lugToLugMm)} lug-to-lug` +
    (caseMm != null ? `, with a ${caseMm} mm case` : "") +
    (profile.thicknessMm != null ? `, ${profile.thicknessMm} mm thickness` : "") +
    (profile.lugWidthMm != null ? ` and ${profile.lugWidthMm} mm lug width` : "") +
    ".";

  return {
    headline,
    paragraphs: [spanParagraph, fitParagraph, ...(thicknessParagraph ? [thicknessParagraph] : [])],
    faq: [
      { question: `What is the lug-to-lug of the ${name}?`, answer: dimensionAnswer },
      { question: `Does the ${name} wear big?`, answer: `${headline}. ${spanParagraph}` },
      { question: `What wrist size does the ${name} fit?`, answer: fitParagraph }
    ]
  };
}

export function describeWearability(
  watch: WearabilityWatch,
  stats?: CatalogStats
): { profile: WearabilityProfile; copy: WearabilityCopy } {
  const profile = buildWearabilityProfile(watch, stats);
  return { profile, copy: buildWearabilityCopy(profile) };
}

export function buildFaqSchema(faq: WearabilityFaq[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer }
    }))
  };
}

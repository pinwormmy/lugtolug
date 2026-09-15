import type { Watch } from "@/types";
import { WRIST_SIZES, classifyFit } from "@/lib/wristGuide";

// Brand pages used to be a heading and a list. This derives a short factual
// introduction from the records themselves (counts, size ranges, wrist fit), so
// every brand page carries text search engines and visitors can read, without
// hand-written copy for 500+ brands.

export interface BrandFamily {
  name: string;
  count: number;
}

export interface BrandSummary {
  brand: string;
  count: number;
  familyCount: number;
  families: BrandFamily[];
  lugToLugMinMm: number;
  lugToLugMaxMm: number;
  lugToLugMedianMm: number;
  caseMinMm: number | null;
  caseMaxMm: number | null;
  thicknessMinMm: number | null;
  thicknessMaxMm: number | null;
  /** Share of records (0-1) that sit in the balanced band on a 6.5" wrist. */
  balancedOnMediumWristShare: number;
}

const MEDIUM_WRIST = WRIST_SIZES.find((size) => size.inches === 6.5) ?? WRIST_SIZES[2]!;

function formatMm(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)} mm`;
}

function formatRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null;
  return min === max ? formatMm(min) : `${formatMm(min)} to ${formatMm(max)}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

function familyName(watch: Watch): string {
  return watch.canonicalModel || watch.model;
}

export function summarizeBrand(watches: Watch[]): BrandSummary | null {
  if (watches.length === 0) return null;

  const familyCounts = new Map<string, number>();
  for (const watch of watches) {
    const name = familyName(watch);
    familyCounts.set(name, (familyCounts.get(name) ?? 0) + 1);
  }
  const families = [...familyCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const lugToLug = watches.map((watch) => watch.lugToLugMm);
  const cases = watches.map((watch) => watch.caseMm).filter((value): value is number => value != null);
  const thicknesses = watches.map((watch) => watch.thicknessMm).filter((value): value is number => value != null);
  const balanced = watches.filter((watch) => classifyFit(watch.lugToLugMm, MEDIUM_WRIST) === "balanced").length;

  return {
    brand: watches[0]!.brand,
    count: watches.length,
    familyCount: families.length,
    families,
    lugToLugMinMm: Math.min(...lugToLug),
    lugToLugMaxMm: Math.max(...lugToLug),
    lugToLugMedianMm: median(lugToLug),
    caseMinMm: cases.length ? Math.min(...cases) : null,
    caseMaxMm: cases.length ? Math.max(...cases) : null,
    thicknessMinMm: thicknesses.length ? Math.min(...thicknesses) : null,
    thicknessMaxMm: thicknesses.length ? Math.max(...thicknesses) : null,
    balancedOnMediumWristShare: balanced / watches.length
  };
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Two or three plain sentences describing the brand's records, for the page intro. */
export function describeBrand(summary: BrandSummary): string[] {
  const recordWord = summary.count === 1 ? "watch" : "watches";
  const span =
    summary.count === 1
      ? `It measures ${formatMm(summary.lugToLugMinMm)} lug-to-lug`
      : `Lug-to-lug runs from ${formatMm(summary.lugToLugMinMm)} to ${formatMm(summary.lugToLugMaxMm)}, with a median of ${formatMm(summary.lugToLugMedianMm)}`;
  const caseRange = formatRange(summary.caseMinMm, summary.caseMaxMm);
  const thicknessRange = formatRange(summary.thicknessMinMm, summary.thicknessMaxMm);
  const dimensionParts = [caseRange ? `case diameters of ${caseRange}` : null, thicknessRange ? `thickness of ${thicknessRange}` : null].filter(
    (part): part is string => part != null
  );

  const first = `${summary.brand} has ${summary.count.toLocaleString("en-US")} ${recordWord} in the database${
    summary.count > 1 && summary.familyCount > 1 ? ` across ${summary.familyCount.toLocaleString("en-US")} model families` : ""
  }. ${span}${dimensionParts.length ? `, alongside ${listNames(dimensionParts)}` : ""}.`;

  const balancedPercent = Math.round(summary.balancedOnMediumWristShare * 100);
  const fit =
    summary.count === 1
      ? null
      : balancedPercent === 0
        ? `None of them fall in the balanced range on a ${MEDIUM_WRIST.inches}-inch wrist, so check the wrist guide before choosing.`
        : `${balancedPercent}% of them sit in the balanced range on a ${MEDIUM_WRIST.inches}-inch wrist.`;

  const topFamilies = summary.families.slice(0, 3).filter((family) => family.count > 1);
  const familiesSentence =
    summary.familyCount > 1 && topFamilies.length > 0
      ? `The most documented ${topFamilies.length === 1 ? "family is" : "families are"} ${listNames(
          topFamilies.map((family) => `${family.name} (${family.count})`)
        )}.`
      : null;

  return [first, fit, familiesSentence].filter((sentence): sentence is string => sentence != null);
}

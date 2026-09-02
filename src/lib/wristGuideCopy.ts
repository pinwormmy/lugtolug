import type { Watch } from "@/types";
import { mmToInches } from "@/lib/fit";
import { getWatchDisplayName, getWatchHref } from "@/lib/watch";
import type { WearabilityFaq } from "@/lib/watchWearability";
import {
  WRIST_SIZES,
  classifyFit,
  smallestBalancedWrist,
  smallestCompactWrist,
  type BrandCount,
  type LugToLugLimit,
  type WristFitBand,
  type WristGuide
} from "@/lib/wristGuide";

// Titles, descriptions, and FAQ copy for the guide pages, kept out of the
// templates so the wording can be tested and tuned in one place.

export interface GuideCopy {
  title: string;
  description: string;
  heading: string;
  lede: string;
  faq: WearabilityFaq[];
}

const BAND_LABELS: Record<WristFitBand, string> = {
  compact: "compact",
  balanced: "balanced",
  large: "large",
  borderline: "borderline",
  overhang: "likely to overhang"
};

function inches(value: number): string {
  return `${mmToInches(value).toFixed(2)} in`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

export function describeWristGuide(guide: WristGuide): GuideCopy {
  const { size, genre, bands, counts } = guide;
  const noun = genre ? genre.singular : "watch";
  const nouns = genre ? genre.name.toLowerCase() : "watches";
  const balancedCount = counts.balanced.toLocaleString("en-US");
  const totalCount = counts.total.toLocaleString("en-US");
  const wrist = `${size.inches} inch wrist`;

  const heading = genre ? `${genre.name} for a ${size.label} wrist` : `Watches for a ${size.label} wrist`;
  const title = genre
    ? `${genre.name} for a ${size.inches} inch wrist (${size.cm} cm): lug-to-lug guide`
    : `${size.small ? "Small wrist watches" : "Watches"} for a ${size.inches} inch wrist (${size.cm} cm): lug-to-lug guide`;
  const description =
    `Lug-to-lug sizes that fit a ${size.inches} in (${size.cm} cm) wrist: balanced from ${bands.compactMaxMm} to ${bands.balancedMaxMm} mm ` +
    `with a sweet spot near ${bands.sweetSpotMm} mm. ${balancedCount} ${plural(counts.balanced, noun, nouns)} from the database ranked by fit.`;
  const lede =
    `Assuming a flat wrist width of about ${bands.flatWidthMm} mm (35% of a ${size.cm} cm circumference), ` +
    `lug-to-lug spans between ${bands.compactMaxMm} and ${bands.balancedMaxMm} mm sit in the balanced range, with ${bands.sweetSpotMm} mm as the sweet spot. ` +
    `${balancedCount} of the ${totalCount} ${nouns} in the database land there.`;

  const faq: WearabilityFaq[] = [
    {
      question: `What lug-to-lug fits a ${wrist}?`,
      answer:
        `On a ${size.label} wrist, a lug-to-lug between ${bands.compactMaxMm} and ${bands.balancedMaxMm} mm (${inches(bands.compactMaxMm)} to ${inches(bands.balancedMaxMm)}) reads as balanced, ` +
        `and about ${bands.sweetSpotMm} mm is the sweet spot. Spans up to ${bands.largeMaxMm} mm still wear well but look large, and anything past ${bands.borderlineMaxMm} mm is likely to overhang.`
    },
    {
      question: `How big a ${noun} can a ${wrist} wear?`,
      answer:
        `Up to about ${bands.largeMaxMm} mm lug-to-lug wears large but stays on the wrist; ${bands.largeMaxMm} to ${bands.borderlineMaxMm} mm is borderline and worth trying on first. ` +
        `Case diameter matters less than the lug-to-lug span, which is why a ${size.inches} inch wrist can carry a 42 mm case with short lugs more easily than a 40 mm case with long ones.`
    },
    {
      question: "How do I measure my wrist for lug-to-lug?",
      answer:
        "Measure the flat width straight across the top of your wrist where the watch sits, not the circumference. " +
        `This guide estimates flat width as 35% of circumference, so a ${size.cm} cm wrist is treated as ${bands.flatWidthMm} mm across; enter your own measurement in the fit calculator on any watch page for an exact result.`
    }
  ];

  return { title, description, heading, lede, faq };
}

export interface LugToLugLimitStats {
  count: number;
  brandCount: number;
  topBrands: BrandCount[];
}

export function describeLugToLugLimit(limit: LugToLugLimit, stats: LugToLugLimitStats): GuideCopy {
  const count = stats.count.toLocaleString("en-US");
  const span = limit.representativeMm;
  const balancedFrom = smallestBalancedWrist(span);
  const compactFrom = smallestCompactWrist(span);
  const wristSentence =
    (balancedFrom ? `A ${span} mm span reads as balanced from a ${balancedFrom.label} wrist` : `A ${span} mm span reads as balanced on wrists larger than those listed here`) +
    (compactFrom ? ` and as compact from ${compactFrom.label}.` : ".");
  const heading =
    limit.kind === "ceiling"
      ? `Watches under ${limit.maxMm} mm lug-to-lug`
      : limit.kind === "floor"
        ? `Watches over ${limit.minMm} mm lug-to-lug`
        : `Watches with a ${limit.minMm}–${limit.maxMm} mm lug-to-lug`;

  return {
    title: `${heading}: ${count} models`,
    description: `${count} watches with a lug-to-lug ${limit.rangeLabel} across ${stats.brandCount} brands. ${limit.wristHint} ${wristSentence}`,
    heading,
    lede: `${count} ${plural(stats.count, "watch", "watches")} in the database span ${limit.rangeLabel} from lug tip to lug tip. ${limit.wristHint} ${wristSentence}`,
    faq: [
      {
        question: `Which wrist sizes suit a lug-to-lug ${limit.rangeLabel}?`,
        answer: `Taking ${span} mm as the reference span: ` + WRIST_SIZES.map((size) => `${size.label}: ${BAND_LABELS[classifyFit(span, size)]}`).join("; ") + "."
      },
      {
        question: `How many watches ${limit.rangeLabel} lug-to-lug are listed?`,
        answer:
          `${count} watches from ${stats.brandCount} brands, ` +
          `led by ${stats.topBrands.slice(0, 3).map((brand) => `${brand.brand} (${brand.count})`).join(", ")}.`
      }
    ]
  };
}

export function buildItemListSchema(origin: string, watches: Watch[], limit = 20): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: watches.slice(0, limit).map((watch, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: getWatchDisplayName(watch),
      url: `${origin}${getWatchHref(watch)}`
    }))
  };
}

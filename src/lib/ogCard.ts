import type { Watch } from "@/types";
import { mmToInches } from "@/lib/fit";
import { getWatchDisplayModel } from "@/lib/watch";

// SVG templates for the Open Graph cards rendered to PNG at build time by
// src/integrations/ogImages.ts. Bump the version whenever the layout changes
// so cached cards are regenerated.
export const OG_TEMPLATE_VERSION = "2026-09-02.1";
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const COLORS = {
  bg: "#0c111a",
  panel: "#121a28",
  line: "#223043",
  ink: "#dce6f2",
  muted: "#93a4b8",
  mutedSoft: "#5f7085",
  accent: "#5fd39a",
  accentStrong: "#8ceebb"
};
const FONT_FAMILY = "'DejaVu Sans', sans-serif";
const MARGIN = 72;
const CONTENT_WIDTH = OG_WIDTH - MARGIN * 2;
// DejaVu Sans Bold averages roughly two thirds of an em per glyph.
const GLYPH_WIDTH_FACTOR = 0.66;

type OgWatch = Pick<
  Watch,
  "brand" | "model" | "canonicalModel" | "reference" | "variant" | "lugToLugMm" | "caseMm" | "thicknessMm" | "lugWidthMm"
>;

export interface OgBrandSummary {
  brand: string;
  count: number;
  lugToLugMinMm: number;
  lugToLugMaxMm: number;
  caseMinMm: number | null;
  caseMaxMm: number | null;
  thicknessMinMm: number | null;
  thicknessMaxMm: number | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Pick the largest font size (down to `minSize`) at which `text` fits, truncating if it still overflows. */
function fitText(text: string, maxWidth: number, maxSize: number, minSize: number): { text: string; size: number } {
  const trimmed = text.trim();
  const widthAt = (size: number, length: number) => length * size * GLYPH_WIDTH_FACTOR;
  const size = Math.max(minSize, Math.min(maxSize, Math.floor(maxWidth / (trimmed.length * GLYPH_WIDTH_FACTOR))));
  if (widthAt(size, trimmed.length) <= maxWidth) return { text: trimmed, size };

  const maxChars = Math.max(1, Math.floor(maxWidth / (size * GLYPH_WIDTH_FACTOR)) - 1);
  return { text: `${trimmed.slice(0, maxChars).trimEnd()}…`, size };
}

function text(
  content: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  options: { weight?: "bold" | "normal"; anchor?: "start" | "end"; letterSpacing?: number } = {}
): string {
  const attributes = [
    `x="${x}"`,
    `y="${y}"`,
    `font-family="${FONT_FAMILY}"`,
    `font-size="${size}"`,
    `font-weight="${options.weight ?? "bold"}"`,
    `fill="${fill}"`,
    options.anchor ? `text-anchor="${options.anchor}"` : "",
    options.letterSpacing ? `letter-spacing="${options.letterSpacing}"` : ""
  ]
    .filter(Boolean)
    .join(" ");
  return `<text ${attributes}>${escapeXml(content)}</text>`;
}

function frame(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLORS.bg}"/>
<rect width="${OG_WIDTH}" height="6" fill="${COLORS.accent}"/>
<rect x="${MARGIN}" y="84" width="16" height="16" fill="${COLORS.accent}"/>
${text("LUG TO LUG FINDER", MARGIN + 30, 99, 20, COLORS.muted, { letterSpacing: 3 })}
${body}
${text("lugtolugfinder.com", MARGIN, OG_HEIGHT - 40, 24, COLORS.muted)}
</svg>`;
}

function formatMm(value: number | null | undefined): string {
  return value == null ? "—" : String(value);
}

function formatRange(min: number | null, max: number | null): string {
  if (min == null || max == null) return "—";
  return min === max ? `${min}` : `${min}–${max}`;
}

interface Tile {
  label: string;
  value: string;
  unit: string;
  detail?: string;
  highlight?: boolean;
}

function tiles(items: Tile[], y: number, height: number): string {
  const gap = 16;
  const width = (CONTENT_WIDTH - gap * (items.length - 1)) / items.length;
  return items
    .map((tile, index) => {
      const x = MARGIN + index * (width + gap);
      const stroke = tile.highlight ? COLORS.accent : COLORS.line;
      const labelColor = tile.highlight ? COLORS.accent : COLORS.muted;
      const valueColor = tile.highlight ? COLORS.accentStrong : COLORS.ink;
      const value = fitText(tile.value, width - 48 - (tile.unit ? 52 : 0), tile.highlight ? 60 : 50, 28);
      const unitX = 24 + value.text.length * value.size * GLYPH_WIDTH_FACTOR + 10;
      return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${COLORS.panel}" stroke="${stroke}" stroke-width="${tile.highlight ? 2 : 1}"/>
${text(tile.label.toUpperCase(), x + 24, y + 44, 18, labelColor, { letterSpacing: 2 })}
${text(value.text, x + 24, y + 116, value.size, valueColor)}
${tile.unit && tile.value !== "—" ? text(tile.unit, x + unitX, y + 116, 24, COLORS.muted, { weight: "normal" }) : ""}
${tile.detail ? text(tile.detail, x + 24, y + height - 24, 20, COLORS.mutedSoft, { weight: "normal" }) : ""}`;
    })
    .join("\n");
}

export function renderWatchOgSvg(watch: OgWatch): string {
  const brand = fitText(watch.brand, CONTENT_WIDTH, 36, 26);
  const model = fitText(getWatchDisplayModel(watch), CONTENT_WIDTH, 64, 36);
  const referenceLine = [watch.reference, watch.variant].filter(Boolean).join(" · ");
  const reference = fitText(referenceLine, CONTENT_WIDTH, 26, 20);

  const body = [
    text(brand.text, MARGIN, 178, brand.size, COLORS.muted),
    text(model.text, MARGIN, 252, model.size, COLORS.ink),
    reference.text ? text(reference.text, MARGIN, 300, reference.size, COLORS.mutedSoft, { weight: "normal" }) : "",
    tiles(
      [
        {
          label: "Lug-to-lug",
          value: formatMm(watch.lugToLugMm),
          unit: "mm",
          detail: `${mmToInches(watch.lugToLugMm).toFixed(2)} in`,
          highlight: true
        },
        { label: "Case", value: formatMm(watch.caseMm), unit: "mm" },
        { label: "Thickness", value: formatMm(watch.thicknessMm), unit: "mm" },
        { label: "Lug width", value: formatMm(watch.lugWidthMm), unit: "mm" }
      ],
      344,
      188
    )
  ].join("\n");

  return frame(body);
}

export function renderBrandOgSvg(summary: OgBrandSummary): string {
  const brand = fitText(summary.brand, CONTENT_WIDTH, 76, 40);
  const countLine = `${summary.count.toLocaleString("en-US")} watch${summary.count === 1 ? "" : "es"} with lug-to-lug measurements`;

  const body = [
    text(brand.text, MARGIN, 226, brand.size, COLORS.ink),
    text(countLine, MARGIN, 290, 30, COLORS.muted, { weight: "normal" }),
    tiles(
      [
        {
          label: "Lug-to-lug range",
          value: formatRange(summary.lugToLugMinMm, summary.lugToLugMaxMm),
          unit: "mm",
          highlight: true
        },
        { label: "Case range", value: formatRange(summary.caseMinMm, summary.caseMaxMm), unit: "mm" },
        { label: "Thickness range", value: formatRange(summary.thicknessMinMm, summary.thicknessMaxMm), unit: "mm" }
      ],
      344,
      188
    )
  ].join("\n");

  return frame(body);
}

export function renderDefaultOgSvg(catalogSize: number): string {
  const rounded = Math.floor(catalogSize / 100) * 100;
  const body = [
    text("Lug to Lug Finder", MARGIN, 260, 80, COLORS.ink),
    text(
      `Lug-to-lug, case, thickness and lug width for ${rounded.toLocaleString("en-US")}+ watches`,
      MARGIN,
      330,
      34,
      COLORS.muted,
      { weight: "normal" }
    ),
    text("Check how a watch fits your wrist before you buy.", MARGIN, 390, 30, COLORS.accentStrong, { weight: "normal" })
  ].join("\n");

  return frame(body);
}

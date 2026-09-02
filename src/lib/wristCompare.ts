import type { Watch } from "@/types";
import { getFitGuidance, type FitCategory, type FitResult } from "@/lib/fit";

// Shared pieces of the on-wrist comparison: the wrist width every fit tool on
// the site reads and writes, the shareable /compare URL, and the to-scale
// scene geometry (all in millimetres, so every watch renders at one scale).

export const MAX_COMPARE_WATCHES = 3;
export const COMPARE_WATCH_PARAM = "w";
export const COMPARE_WRIST_PARAM = "wrist";
export const DEFAULT_WRIST_FLAT_WIDTH_MM = 54;
export const WRIST_FIT_STORAGE_KEY = "lugtolug-finder:wrist-fit-v1";

export type WatchSlugKey = Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">;

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MIN_WRIST_MM = 30;
const MAX_WRIST_MM = 110;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getCompareKey(watch: WatchSlugKey): string {
  return `${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

export function parseCompareKey(value: string): WatchSlugKey | null {
  const parts = value.split("/");
  if (parts.length !== 3 || !parts.every((part) => SLUG_PATTERN.test(part))) return null;
  const [brandSlug, modelSlug, referenceSlug] = parts;
  return { brandSlug, modelSlug, referenceSlug };
}

export function parseCompareKeys(params: URLSearchParams): WatchSlugKey[] {
  const keys: WatchSlugKey[] = [];
  const seen = new Set<string>();
  for (const value of params.getAll(COMPARE_WATCH_PARAM)) {
    const key = parseCompareKey(value.trim());
    if (!key || seen.has(getCompareKey(key))) continue;
    seen.add(getCompareKey(key));
    keys.push(key);
    if (keys.length === MAX_COMPARE_WATCHES) break;
  }
  return keys;
}

export function parseWristFlatWidth(value: string | null | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= MIN_WRIST_MM && parsed <= MAX_WRIST_MM ? round1(parsed) : null;
}

export function buildCompareHref(watches: WatchSlugKey[], wristFlatWidthMm?: number | null): string {
  const params = new URLSearchParams();
  for (const watch of watches.slice(0, MAX_COMPARE_WATCHES)) params.append(COMPARE_WATCH_PARAM, getCompareKey(watch));
  const wrist = wristFlatWidthMm == null ? null : parseWristFlatWidth(String(wristFlatWidthMm));
  if (wrist != null) params.set(COMPARE_WRIST_PARAM, String(wrist));
  const query = params.toString();
  return query ? `/compare?${query}` : "/compare";
}

/** The flat wrist width saved by the fit calculator, as the string the inputs hold. */
export function readSavedWristFlatWidth(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(WRIST_FIT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<{ unit: string; value: unknown }>;
    if (typeof parsed.value !== "string") return null;

    // Early versions stored a circumference with a unit; convert to flat width.
    if (parsed.unit === "cm") return ((Number(parsed.value) * 10) / Math.PI).toFixed(1);
    if (parsed.unit === "in") return ((Number(parsed.value) * 25.4) / Math.PI).toFixed(1);
    return parsed.value;
  } catch {
    return null;
  }
}

export function saveWristFlatWidth(value: string): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WRIST_FIT_STORAGE_KEY, JSON.stringify({ value }));
  } catch {
    // Storage can be unavailable (private mode, quota); the inputs still work.
  }
}

export interface CompareScene {
  /** Shared viewBox width so every watch renders at the same mm scale. */
  viewWidthMm: number;
  viewHeightMm: number;
  profileHeightMm: number;
}

type SceneWatch = Pick<Watch, "lugToLugMm" | "caseMm" | "thicknessMm">;

/** Case diameter to draw when it is unknown: lugs usually add ~15% to the case. */
export function estimateCaseMm(watch: Pick<Watch, "lugToLugMm" | "caseMm">): number {
  return watch.caseMm ?? round1(watch.lugToLugMm * 0.85);
}

export function computeCompareScene(watches: SceneWatch[], wristFlatWidthMm: number | null): CompareScene {
  const widestSpan = Math.max(wristFlatWidthMm ?? 0, 40, ...watches.map((watch) => Math.max(watch.lugToLugMm, estimateCaseMm(watch))));
  const tallestCase = Math.max(30, ...watches.map(estimateCaseMm));
  const thickest = Math.max(8, ...watches.map((watch) => watch.thicknessMm ?? 0));
  return {
    viewWidthMm: round1(widestSpan + 16),
    viewHeightMm: round1(tallestCase + 20),
    profileHeightMm: round1(thickest + 10)
  };
}

export function describeCompareFit(watch: Pick<Watch, "lugToLugMm">, wristFlatWidthMm: number | null): FitResult | null {
  if (wristFlatWidthMm == null) return null;
  return getFitGuidance(watch.lugToLugMm, wristFlatWidthMm);
}

export const FIT_CATEGORY_COLORS: Record<FitCategory, string> = {
  compact: "var(--muted)",
  balanced: "var(--accent)",
  large: "var(--amber)",
  borderline: "var(--amber)",
  overhang: "var(--danger)"
};

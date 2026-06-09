export type FitCategory = "small" | "balanced" | "large";

export const FIT_SCALE_MARKER_POSITIONS: Record<FitCategory, number> = {
  small: 16.67,
  balanced: 50,
  large: 83.33
} as const;

export interface FitResult {
  category: FitCategory;
  ratio: number;
  wristFlatWidthMm: number;
  wristFlatWidthMinMm: number;
  wristFlatWidthMaxMm: number;
  label: string;
  guidance: string;
}

export function estimateWristFlatWidthMm(wristCircumferenceMm: number): number {
  return wristCircumferenceMm / Math.PI;
}

export function estimateWristFlatWidthRangeMm(wristCircumferenceMm: number, varianceRatio = 0.05): {
  minMm: number;
  maxMm: number;
} {
  const wristFlatWidthMm = estimateWristFlatWidthMm(wristCircumferenceMm);
  return {
    minMm: wristFlatWidthMm * (1 - varianceRatio),
    maxMm: wristFlatWidthMm * (1 + varianceRatio)
  };
}

export function getFitScaleMarkerPosition(category: FitCategory): number {
  return FIT_SCALE_MARKER_POSITIONS[category];
}

export function getFitGuidance(lugToLugMm: number, wristCircumferenceMm: number): FitResult {
  const wristFlatWidthMm = estimateWristFlatWidthMm(wristCircumferenceMm);
  const wristFlatWidthRange = estimateWristFlatWidthRangeMm(wristCircumferenceMm);
  const ratio = lugToLugMm / wristFlatWidthMm;

  if (ratio < 0.8) {
    return {
      category: "small",
      ratio,
      wristFlatWidthMm,
      wristFlatWidthMinMm: wristFlatWidthRange.minMm,
      wristFlatWidthMaxMm: wristFlatWidthRange.maxMm,
      label: "Small",
      guidance: "Sits short across the wrist with visible margin on both sides."
    };
  }

  if (ratio <= 0.9) {
    return {
      category: "balanced",
      ratio,
      wristFlatWidthMm,
      wristFlatWidthMinMm: wristFlatWidthRange.minMm,
      wristFlatWidthMaxMm: wristFlatWidthRange.maxMm,
      label: "Balanced",
      guidance: "Sits comfortably within the wrist width for most wearers."
    };
  }

  return {
    category: "large",
    ratio,
    wristFlatWidthMm,
    wristFlatWidthMinMm: wristFlatWidthRange.minMm,
    wristFlatWidthMaxMm: wristFlatWidthRange.maxMm,
    label: "Large",
    guidance: "Sits near or beyond the wrist edge; case shape and strap angle matter."
  };
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

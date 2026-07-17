export type FitCategory = "compact" | "balanced" | "large" | "borderline" | "overhang";

export const FIT_RATIO_STANDARD = 0.8;
export const FIT_RATIO_THRESHOLDS = {
  balancedMin: 0.75,
  balancedMax: 0.9,
  largeMax: 0.95,
  borderlineMax: 1
} as const;
export const FIT_RATIO_SCALE = {
  min: 0.7,
  max: 1.05
} as const;

export interface FitResult {
  category: FitCategory;
  ratio: number;
  standardRatio: number;
  ratioDeltaFromStandard: number;
  wristFlatWidthMm: number;
  label: string;
  guidance: string;
}

export function getFitScaleMarkerPositionForRatio(ratio: number): number {
  const normalized = (ratio - FIT_RATIO_SCALE.min) / (FIT_RATIO_SCALE.max - FIT_RATIO_SCALE.min);
  return Number(Math.min(100, Math.max(0, normalized * 100)).toFixed(2));
}

export function getFitGuidance(lugToLugMm: number, wristFlatWidthMm: number): FitResult {
  const ratio = lugToLugMm / wristFlatWidthMm;
  const ratioDeltaFromStandard = ratio - FIT_RATIO_STANDARD;

  if (ratio < FIT_RATIO_THRESHOLDS.balancedMin) {
    return {
      category: "compact",
      ratio,
      standardRatio: FIT_RATIO_STANDARD,
      ratioDeltaFromStandard,
      wristFlatWidthMm,
      label: "Compact",
      guidance: "Leaves generous margin on both sides, matching classic and dress-watch proportions."
    };
  }

  if (ratio <= FIT_RATIO_THRESHOLDS.balancedMax) {
    return {
      category: "balanced",
      ratio,
      standardRatio: FIT_RATIO_STANDARD,
      ratioDeltaFromStandard,
      wristFlatWidthMm,
      label: "Balanced",
      guidance: "Sits comfortably within the wrist width for most wearers."
    };
  }

  if (ratio <= FIT_RATIO_THRESHOLDS.largeMax) {
    return {
      category: "large",
      ratio,
      standardRatio: FIT_RATIO_STANDARD,
      ratioDeltaFromStandard,
      wristFlatWidthMm,
      label: "Large",
      guidance: "Fills most of the wrist for a bold, sporty fit; lug shape and end links matter."
    };
  }

  if (ratio <= FIT_RATIO_THRESHOLDS.borderlineMax) {
    return {
      category: "borderline",
      ratio,
      standardRatio: FIT_RATIO_STANDARD,
      ratioDeltaFromStandard,
      wristFlatWidthMm,
      label: "Borderline",
      guidance: "Uses nearly the full wrist width; trying the watch on is strongly recommended."
    };
  }

  return {
    category: "overhang",
    ratio,
    standardRatio: FIT_RATIO_STANDARD,
    ratioDeltaFromStandard,
    wristFlatWidthMm,
    label: "Likely overhang",
    guidance: "Exceeds the measured wrist width and is likely to extend beyond the wrist edge."
  };
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

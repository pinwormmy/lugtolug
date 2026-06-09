export type FitCategory = "small" | "balanced" | "large";

export const FIT_SCALE_MARKER_POSITIONS: Record<FitCategory, number> = {
  small: 16.67,
  balanced: 50,
  large: 83.33
} as const;

export const FIT_RATIO_STANDARD = 0.85;
export const FIT_RATIO_SCALE = {
  min: 0.75,
  max: 0.95
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

export function getFitScaleMarkerPosition(category: FitCategory): number {
  return FIT_SCALE_MARKER_POSITIONS[category];
}

export function getFitScaleMarkerPositionForRatio(ratio: number): number {
  const normalized = (ratio - FIT_RATIO_SCALE.min) / (FIT_RATIO_SCALE.max - FIT_RATIO_SCALE.min);
  return Number(Math.min(100, Math.max(0, normalized * 100)).toFixed(2));
}

export function getFitGuidance(lugToLugMm: number, wristFlatWidthMm: number): FitResult {
  const ratio = lugToLugMm / wristFlatWidthMm;
  const ratioDeltaFromStandard = ratio - FIT_RATIO_STANDARD;

  if (ratio < 0.8) {
    return {
      category: "small",
      ratio,
      standardRatio: FIT_RATIO_STANDARD,
      ratioDeltaFromStandard,
      wristFlatWidthMm,
      label: "Small",
      guidance: "Sits short across the wrist with visible margin on both sides."
    };
  }

  if (ratio <= 0.9) {
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

  return {
    category: "large",
    ratio,
    standardRatio: FIT_RATIO_STANDARD,
    ratioDeltaFromStandard,
    wristFlatWidthMm,
    label: "Large",
    guidance: "Sits near or beyond the wrist edge; case shape and strap angle matter."
  };
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

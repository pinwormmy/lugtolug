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
  label: string;
  guidance: string;
}

export function getFitScaleMarkerPosition(category: FitCategory): number {
  return FIT_SCALE_MARKER_POSITIONS[category];
}

export function getFitGuidance(lugToLugMm: number, wristFlatWidthMm: number): FitResult {
  const ratio = lugToLugMm / wristFlatWidthMm;

  if (ratio < 0.8) {
    return {
      category: "small",
      ratio,
      wristFlatWidthMm,
      label: "Small",
      guidance: "Sits short across the wrist with visible margin on both sides."
    };
  }

  if (ratio <= 0.9) {
    return {
      category: "balanced",
      ratio,
      wristFlatWidthMm,
      label: "Balanced",
      guidance: "Sits comfortably within the wrist width for most wearers."
    };
  }

  return {
    category: "large",
    ratio,
    wristFlatWidthMm,
    label: "Large",
    guidance: "Sits near or beyond the wrist edge; case shape and strap angle matter."
  };
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

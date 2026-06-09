export type FitCategory = "compact" | "balanced" | "large" | "oversized";

export const FIT_SCALE_MARKER_POSITIONS: Record<FitCategory, number> = {
  compact: 12.5,
  balanced: 37.5,
  large: 62.5,
  oversized: 87.5
} as const;

export interface FitResult {
  category: FitCategory;
  ratio: number;
  wristFlatWidthMm: number;
  label: string;
  guidance: string;
}

export function estimateWristFlatWidthMm(wristCircumferenceMm: number): number {
  return wristCircumferenceMm / Math.PI;
}

export function getFitScaleMarkerPosition(category: FitCategory): number {
  return FIT_SCALE_MARKER_POSITIONS[category];
}

export function getFitGuidance(lugToLugMm: number, wristCircumferenceMm: number): FitResult {
  const wristFlatWidthMm = estimateWristFlatWidthMm(wristCircumferenceMm);
  const ratio = lugToLugMm / wristFlatWidthMm;

  if (ratio < 0.82) {
    return {
      category: "compact",
      ratio,
      wristFlatWidthMm,
      label: "Compact",
      guidance: "Likely to wear short across the wrist, with visible margin near both edges."
    };
  }

  if (ratio < 0.93) {
    return {
      category: "balanced",
      ratio,
      wristFlatWidthMm,
      label: "Balanced",
      guidance: "Likely to sit comfortably within the wrist width for most wearers."
    };
  }

  if (ratio < 1.02) {
    return {
      category: "large",
      ratio,
      wristFlatWidthMm,
      label: "Large",
      guidance: "Likely to wear near the wrist edge; case shape and strap angle matter."
    };
  }

  return {
    category: "oversized",
    ratio,
    wristFlatWidthMm,
    label: "Oversized",
    guidance: "Likely to extend beyond the flat wrist width for many wearers."
  };
}

export function mmToInches(value: number): number {
  return value / 25.4;
}

import { useEffect, useMemo, useState } from "react";
import {
  FIT_RATIO_STANDARD,
  getFitGuidance,
  getFitScaleMarkerPositionForRatio
} from "@/lib/fit";

interface Props {
  lugToLugMm: number;
}

const STORAGE_KEY = "lugtolug-finder:wrist-fit-v1";

function readSavedFitSettings(): { value: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<{ unit: string; value: unknown }>;
    if (typeof parsed.value !== "string") {
      return null;
    }

    if (parsed.unit === "cm") {
      return { value: `${(((Number(parsed.value) * 10) / Math.PI)).toFixed(1)}` };
    }

    if (parsed.unit === "in") {
      return { value: `${(((Number(parsed.value) * 25.4) / Math.PI)).toFixed(1)}` };
    }

    return { value: parsed.value };
  } catch {
    return null;
  }
}

export default function FitCalculator({ lugToLugMm }: Props) {
  const [value, setValue] = useState("54.0");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readSavedFitSettings();
    if (saved) {
      setValue(saved.value);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ value }));
  }, [hydrated, value]);

  const fit = useMemo(() => {
    const wristFlatWidthMm = Number(value);
    if (!Number.isFinite(wristFlatWidthMm) || wristFlatWidthMm <= 0) return null;
    return getFitGuidance(lugToLugMm, wristFlatWidthMm);
  }, [lugToLugMm, value]);
  const markerPosition = fit ? getFitScaleMarkerPositionForRatio(fit.ratio) : 0;

  return (
    <div className="panel fit-analyzer">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Wrist fit analyzer</p>
          <h2>Fit reference</h2>
        </div>
      </div>
      <div className="fit-controls">
        <label>
          <span>Flat wrist width</span>
          <input
            className="input"
            inputMode="decimal"
            aria-label="Flat wrist width"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </label>
      </div>
      {fit ? (
        <>
          <div className="fit-scale" aria-label={`Fit verdict ${fit.label}, ratio ${fit.ratio.toFixed(2)} against standard ${FIT_RATIO_STANDARD.toFixed(2)}`}>
            <span className="fit-scale-standard" aria-hidden="true" style={{ left: "50%" }} />
            <span style={{ left: `${markerPosition}%` }} />
          </div>
          <div className="fit-scale-labels">
            <span>Small</span>
            <span>Balanced</span>
            <span>Large</span>
          </div>
          <div className={`fit-verdict ${fit.category}`}>
            <strong>{fit.label}</strong>
            <p>{fit.guidance}</p>
          </div>
        </>
      ) : (
        <p className="small">Enter a flat wrist width to estimate the fit.</p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { getFitGuidance, getFitScaleMarkerPosition } from "@/lib/fit";

interface Props {
  lugToLugMm: number;
}

const STORAGE_KEY = "lugtolug-finder:wrist-fit-v1";

function readSavedFitSettings(): { unit: "cm" | "in"; value: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<{ unit: string; value: unknown }>;
    if ((parsed.unit !== "cm" && parsed.unit !== "in") || typeof parsed.value !== "string") {
      return null;
    }

    return { unit: parsed.unit, value: parsed.value };
  } catch {
    return null;
  }
}

export default function FitCalculator({ lugToLugMm }: Props) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [value, setValue] = useState("17.0");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readSavedFitSettings();
    if (saved) {
      setUnit(saved.unit);
      setValue(saved.value);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ unit, value }));
  }, [hydrated, unit, value]);

  const wristMm = unit === "cm" ? Number(value) * 10 : Number(value) * 25.4;
  const fit = useMemo(() => {
    if (!Number.isFinite(wristMm) || wristMm <= 0) return null;
    return getFitGuidance(lugToLugMm, wristMm);
  }, [lugToLugMm, wristMm]);
  const markerPosition = fit ? getFitScaleMarkerPosition(fit.category) : 0;

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
          <span>Wrist circumference</span>
          <input
            className="input"
            inputMode="decimal"
            aria-label="Wrist circumference"
            value={value}
            onChange={(event) => setValue(event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Unit</span>
          <select className="select" aria-label="Wrist unit" value={unit} onChange={(event) => setUnit(event.currentTarget.value as "cm" | "in")}>
            <option value="cm">cm</option>
            <option value="in">in</option>
          </select>
        </label>
      </div>
      {fit ? (
        <>
          <div className="fit-stats">
            <span>
              <small>Flat wrist width</small>
              <strong>
                {fit.wristFlatWidthMinMm.toFixed(1)} mm ~ {fit.wristFlatWidthMaxMm.toFixed(1)} mm
              </strong>
            </span>
            <span>
              <small>Fit ratio</small>
              <strong>{fit.ratio.toFixed(2)}</strong>
            </span>
          </div>
          <div className="fit-scale" aria-label={`Fit verdict ${fit.label}`}>
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
        <p className="small">Enter a wrist circumference to estimate the fit.</p>
      )}
    </div>
  );
}

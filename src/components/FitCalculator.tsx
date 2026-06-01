import { useMemo, useState } from "react";
import { getFitGuidance } from "@/lib/fit";

interface Props {
  lugToLugMm: number;
}

export default function FitCalculator({ lugToLugMm }: Props) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [value, setValue] = useState("17.0");
  const wristMm = unit === "cm" ? Number(value) * 10 : Number(value) * 25.4;
  const fit = useMemo(() => {
    if (!Number.isFinite(wristMm) || wristMm <= 0) return null;
    return getFitGuidance(lugToLugMm, wristMm);
  }, [lugToLugMm, wristMm]);
  const ratioPosition = fit ? Math.max(0, Math.min(100, ((fit.ratio - 0.5) / 0.6) * 100)) : 0;

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
              <strong>{fit.wristFlatWidthMm.toFixed(1)} mm</strong>
            </span>
            <span>
              <small>Fit ratio</small>
              <strong>{fit.ratio.toFixed(2)}</strong>
            </span>
          </div>
          <div className="fit-scale" aria-label={`Fit ratio ${fit.ratio.toFixed(2)}`}>
            <span style={{ left: `${ratioPosition}%` }} />
          </div>
          <div className="fit-scale-labels">
            <span>Too small</span>
            <span>Ideal</span>
            <span>Large</span>
            <span>Too large</span>
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

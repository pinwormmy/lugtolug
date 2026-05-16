import { useMemo, useState } from "react";
import { getFitGuidance } from "@/lib/fit";

interface Props {
  lugToLugMm: number;
}

export default function FitCalculator({ lugToLugMm }: Props) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  const [value, setValue] = useState("17");
  const wristMm = unit === "cm" ? Number(value) * 10 : Number(value) * 25.4;
  const fit = useMemo(() => {
    if (!Number.isFinite(wristMm) || wristMm <= 0) return null;
    return getFitGuidance(lugToLugMm, wristMm);
  }, [lugToLugMm, wristMm]);

  return (
    <div className="panel">
      <h2>Wrist fit reference</h2>
      <div className="search-input-row">
        <input
          className="input"
          inputMode="decimal"
          aria-label="Wrist circumference"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
        />
        <select className="select" aria-label="Wrist unit" value={unit} onChange={(event) => setUnit(event.currentTarget.value as "cm" | "in")}>
          <option value="cm">cm</option>
          <option value="in">in</option>
        </select>
      </div>
      {fit ? (
        <div className="notice" style={{ marginTop: 14 }}>
          <strong>{fit.label}</strong>
          <p style={{ margin: "6px 0 0" }}>{fit.guidance}</p>
          <p className="small" style={{ margin: "8px 0 0" }}>
            Estimated flat wrist width: {fit.wristFlatWidthMm.toFixed(1)} mm. Lug-to-lug uses {(fit.ratio * 100).toFixed(0)}% of it.
          </p>
        </div>
      ) : (
        <p className="small">Enter a wrist circumference to estimate the fit.</p>
      )}
    </div>
  );
}

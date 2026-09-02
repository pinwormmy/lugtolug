import { useEffect, useMemo, useState } from "react";
import {
  FIT_RATIO_STANDARD,
  getFitGuidance,
  getFitScaleMarkerPositionForRatio
} from "@/lib/fit";
import { buildCompareHref, readSavedWristFlatWidth, saveWristFlatWidth, type WatchSlugKey } from "@/lib/wristCompare";

interface Props {
  lugToLugMm: number;
  /** When given, offers to open this watch in the on-wrist comparison. */
  compareWatch?: WatchSlugKey;
}

export default function FitCalculator({ lugToLugMm, compareWatch }: Props) {
  const [value, setValue] = useState("54.0");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Shared with the compare page, so the wrist entered anywhere applies everywhere.
    const saved = readSavedWristFlatWidth();
    if (saved) {
      setValue(saved);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    saveWristFlatWidth(value);
  }, [hydrated, value]);

  const fit = useMemo(() => {
    const wristFlatWidthMm = Number(value);
    if (!Number.isFinite(wristFlatWidthMm) || wristFlatWidthMm <= 0) return null;
    return getFitGuidance(lugToLugMm, wristFlatWidthMm);
  }, [lugToLugMm, value]);
  const markerPosition = fit ? getFitScaleMarkerPositionForRatio(fit.ratio) : 0;
  const standardMarkerPosition = getFitScaleMarkerPositionForRatio(FIT_RATIO_STANDARD);

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
            <span className="fit-scale-standard" aria-hidden="true" style={{ left: `${standardMarkerPosition}%` }} />
            <span style={{ left: `${markerPosition}%` }} />
          </div>
          <div className="fit-scale-labels">
            <span>Compact</span>
            <span>Balanced</span>
            <span>Large</span>
            <span>Edge</span>
            <span>Overhang</span>
          </div>
          <div className={`fit-verdict ${fit.category}`}>
            <strong>{fit.label}</strong>
            <p>{fit.guidance}</p>
          </div>
        </>
      ) : (
        <p className="small">Enter a flat wrist width to estimate the fit.</p>
      )}
      {compareWatch && (
        <p className="fit-compare-link">
          <a className="button secondary" href={buildCompareHref([compareWatch], fit ? fit.wristFlatWidthMm : null)}>
            Compare on your wrist
          </a>
        </p>
      )}
    </div>
  );
}

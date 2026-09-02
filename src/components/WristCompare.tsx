import { Copy, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWatchDatabase } from "@/hooks/useWatchDatabase";
import { WRIST_FLAT_WIDTH_RATIO, mmToInches } from "@/lib/fit";
import { formatMm, getWatchDisplayName, getWatchHref, watchMatchesSearchQuery } from "@/lib/watch";
import {
  DEFAULT_WRIST_FLAT_WIDTH_MM,
  FIT_CATEGORY_COLORS,
  MAX_COMPARE_WATCHES,
  buildCompareHref,
  computeCompareScene,
  describeCompareFit,
  estimateCaseMm,
  getCompareKey,
  parseWristFlatWidth,
  readSavedWristFlatWidth,
  saveWristFlatWidth,
  type CompareScene
} from "@/lib/wristCompare";
import type { Watch } from "@/types";

interface Props {
  initialWatches: Watch[];
  /** From the shared URL; otherwise the saved calculator value is used. */
  initialWristFlatWidthMm: number | null;
}

const EMPTY: Watch[] = [];
const MAX_RESULTS = 8;

function TopView({ watch, wristFlatWidthMm, scene }: { watch: Watch; wristFlatWidthMm: number | null; scene: CompareScene }) {
  const cx = scene.viewWidthMm / 2;
  const cy = scene.viewHeightMm / 2;
  const caseMm = estimateCaseMm(watch);
  const strapMm = watch.lugWidthMm ?? caseMm * 0.5;
  const fit = describeCompareFit(watch, wristFlatWidthMm);
  const accent = fit ? FIT_CATEGORY_COLORS[fit.category] : "var(--line-strong)";
  const overhang = wristFlatWidthMm != null ? Math.max(0, (watch.lugToLugMm - wristFlatWidthMm) / 2) : 0;

  return (
    <svg
      className="compare-top"
      viewBox={`0 0 ${scene.viewWidthMm} ${scene.viewHeightMm}`}
      role="img"
      aria-label={`${getWatchDisplayName(watch)} drawn to scale on a ${wristFlatWidthMm ?? "—"} mm wide wrist`}
    >
      {wristFlatWidthMm != null && (
        <rect
          x={cx - wristFlatWidthMm / 2}
          y={0}
          width={wristFlatWidthMm}
          height={scene.viewHeightMm}
          rx={3}
          style={{ fill: "var(--panel-soft)", stroke: "var(--line-strong)", strokeWidth: 0.4 }}
        />
      )}
      <rect
        x={cx - watch.lugToLugMm / 2}
        y={cy - strapMm / 2}
        width={watch.lugToLugMm}
        height={strapMm}
        rx={1.5}
        style={{ fill: "var(--panel-raised)", stroke: accent, strokeWidth: 0.9 }}
      />
      {overhang > 0 && (
        <>
          <rect x={cx - watch.lugToLugMm / 2} y={cy - strapMm / 2} width={overhang} height={strapMm} rx={1.5} style={{ fill: "var(--danger)", opacity: 0.55 }} />
          <rect x={cx + watch.lugToLugMm / 2 - overhang} y={cy - strapMm / 2} width={overhang} height={strapMm} rx={1.5} style={{ fill: "var(--danger)", opacity: 0.55 }} />
        </>
      )}
      <circle cx={cx} cy={cy} r={caseMm / 2} style={{ fill: "var(--panel-raised)", stroke: "var(--ink)", strokeWidth: 0.8, strokeDasharray: watch.caseMm == null ? "1.5 1.2" : undefined }} />
      <circle cx={cx} cy={cy} r={Math.max(caseMm / 2 - 1.8, 4)} style={{ fill: "var(--bg)", stroke: "var(--line-strong)", strokeWidth: 0.3 }} />
      <rect x={cx - caseMm / 2 + 2.6} y={cy - 0.6} width={3} height={1.2} style={{ fill: "var(--ink)" }} />
      <circle cx={cx} cy={cy} r={0.7} style={{ fill: "var(--ink)" }} />
    </svg>
  );
}

function ProfileView({ watch, scene }: { watch: Watch; scene: CompareScene }) {
  const caseMm = estimateCaseMm(watch);
  const cx = scene.viewWidthMm / 2;
  const surfaceY = scene.profileHeightMm - 4;
  const thickness = watch.thicknessMm;

  return (
    <svg
      className="compare-profile"
      viewBox={`0 0 ${scene.viewWidthMm} ${scene.profileHeightMm}`}
      role="img"
      aria-label={`${getWatchDisplayName(watch)} side profile, ${thickness == null ? "thickness unknown" : `${thickness} mm thick`}`}
    >
      <rect x={0} y={surfaceY} width={scene.viewWidthMm} height={4} style={{ fill: "var(--panel-soft)" }} />
      <line x1={0} y1={surfaceY} x2={scene.viewWidthMm} y2={surfaceY} style={{ stroke: "var(--line-strong)", strokeWidth: 0.4 }} />
      {thickness != null ? (
        <rect x={cx - caseMm / 2} y={surfaceY - thickness} width={caseMm} height={thickness} rx={1} style={{ fill: "var(--panel-raised)", stroke: "var(--ink)", strokeWidth: 0.7 }} />
      ) : (
        <rect x={cx - caseMm / 2} y={surfaceY - 10} width={caseMm} height={10} rx={1} style={{ fill: "none", stroke: "var(--muted-soft)", strokeWidth: 0.6, strokeDasharray: "1.5 1.2" }} />
      )}
    </svg>
  );
}

export default function WristCompare({ initialWatches, initialWristFlatWidthMm }: Props) {
  const [selected, setSelected] = useState<Watch[]>(initialWatches);
  const [wristValue, setWristValue] = useState(String(initialWristFlatWidthMm ?? DEFAULT_WRIST_FLAT_WIDTH_MM));
  const [circumferenceValue, setCircumferenceValue] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [searchWanted, setSearchWanted] = useState(false);
  const [copied, setCopied] = useState(false);
  const { watches: catalog, status, retry } = useWatchDatabase(searchWanted ? undefined : EMPTY, false);

  const wristFlatWidthMm = parseWristFlatWidth(wristValue);
  const scene = useMemo(() => computeCompareScene(selected, wristFlatWidthMm), [selected, wristFlatWidthMm]);
  const selectedKeys = useMemo(() => new Set(selected.map(getCompareKey)), [selected]);
  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return catalog.filter((watch) => !selectedKeys.has(getCompareKey(watch)) && watchMatchesSearchQuery(watch, trimmed)).slice(0, MAX_RESULTS);
  }, [catalog, query, selectedKeys]);
  const shareHref = buildCompareHref(selected, wristFlatWidthMm);
  const full = selected.length >= MAX_COMPARE_WATCHES;

  useEffect(() => {
    if (initialWristFlatWidthMm == null) {
      const saved = readSavedWristFlatWidth();
      if (saved && parseWristFlatWidth(saved) != null) setWristValue(saved);
    }
    setHydrated(true);
  }, [initialWristFlatWidthMm]);

  useEffect(() => {
    if (!hydrated || wristFlatWidthMm == null) return;
    saveWristFlatWidth(wristValue);
  }, [hydrated, wristFlatWidthMm, wristValue]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.history.replaceState(window.history.state, "", shareHref);
  }, [hydrated, shareHref]);

  const addWatch = (watch: Watch) => {
    if (full || selectedKeys.has(getCompareKey(watch))) return;
    setSelected((current) => [...current, watch]);
    setQuery("");
  };

  const copyLink = async () => {
    const url = new URL(shareHref, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  };

  return (
    <div className="compare-app">
      <section className="section grid-2" style={{ marginTop: 0 }}>
        <div className="panel">
          <p className="eyebrow">Your wrist</p>
          <h2>Flat wrist width</h2>
          <div className="fit-controls compare-wrist-controls">
            <label>
              <span>Flat width across the top of the wrist (mm)</span>
              <input
                className="input"
                inputMode="decimal"
                aria-label="Flat wrist width in millimetres"
                value={wristValue}
                onChange={(event) => setWristValue(event.currentTarget.value)}
              />
            </label>
            <label>
              <span>Or estimate from circumference (cm)</span>
              <input
                className="input"
                inputMode="decimal"
                aria-label="Wrist circumference in centimetres"
                placeholder="e.g. 16.5"
                value={circumferenceValue}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setCircumferenceValue(value);
                  const cm = Number(value);
                  if (Number.isFinite(cm) && cm > 0) setWristValue((cm * 10 * WRIST_FLAT_WIDTH_RATIO).toFixed(1));
                }}
              />
            </label>
          </div>
          <p className="small">
            {wristFlatWidthMm != null
              ? `Drawing every watch on a ${wristFlatWidthMm} mm (${mmToInches(wristFlatWidthMm).toFixed(2)} in) wide wrist. The same width feeds the fit calculator on every watch page.`
              : "Enter a flat wrist width between 30 and 110 mm."}
          </p>
        </div>

        <div className="panel">
          <p className="eyebrow">Watches</p>
          <h2>Compare up to {MAX_COMPARE_WATCHES}</h2>
          {selected.length > 0 && (
            <ul className="compare-selected">
              {selected.map((watch) => (
                <li key={getCompareKey(watch)}>
                  <a href={getWatchHref(watch)}>{getWatchDisplayName(watch)}</a>
                  <button
                    aria-label={`Remove ${getWatchDisplayName(watch)}`}
                    className="link-button"
                    onClick={() => setSelected((current) => current.filter((entry) => getCompareKey(entry) !== getCompareKey(watch)))}
                    type="button"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label>
            <span className="small">{full ? "Remove a watch to add another." : "Add a watch"}</span>
            <div className="field-with-icon">
              <Search size={17} aria-hidden="true" />
              <input
                className="input"
                aria-label="Search watches to add"
                placeholder="Brand, model, or reference"
                disabled={full}
                value={query}
                onFocus={() => setSearchWanted(true)}
                onChange={(event) => {
                  setSearchWanted(true);
                  setQuery(event.currentTarget.value);
                }}
              />
            </div>
          </label>
          {query.trim() && searchWanted && status === "loading" && <p className="small">Loading the catalog…</p>}
          {status === "error" && (
            <p className="small">
              Couldn&apos;t load the catalog.{" "}
              <button className="link-button" onClick={retry} type="button">Retry</button>
            </p>
          )}
          {results.length > 0 && (
            <ul className="compare-results">
              {results.map((watch) => (
                <li key={watch.id}>
                  <span>
                    <strong>{getWatchDisplayName(watch)}</strong>
                    <small>{watch.reference} · {formatMm(watch.lugToLugMm)} lug-to-lug</small>
                  </span>
                  <button className="button secondary" onClick={() => addWatch(watch)} type="button">Add</button>
                </li>
              ))}
            </ul>
          )}
          {query.trim() && status === "ready" && results.length === 0 && <p className="small">No matching watches.</p>}
        </div>
      </section>

      <section className="section" aria-label="Watches drawn to scale">
        {selected.length === 0 ? (
          <div className="panel">
            <p className="empty-state">Add a watch above, or open any watch page and press “Compare on your wrist”.</p>
          </div>
        ) : (
          <div className="compare-scenes">
            {selected.map((watch) => {
              const fit = describeCompareFit(watch, wristFlatWidthMm);
              return (
                <article className="compare-card" key={getCompareKey(watch)}>
                  <header>
                    <a href={getWatchHref(watch)}><strong>{getWatchDisplayName(watch)}</strong></a>
                    <span className="small">{watch.reference}</span>
                  </header>
                  {fit && <span className={`compare-verdict ${fit.category}`}>{fit.label} · ratio {fit.ratio.toFixed(2)}</span>}
                  <TopView watch={watch} wristFlatWidthMm={wristFlatWidthMm} scene={scene} />
                  <ProfileView watch={watch} scene={scene} />
                  <dl className="compare-metrics">
                    <div><dt>Lug-to-lug</dt><dd>{formatMm(watch.lugToLugMm)}</dd></div>
                    <div><dt>Case</dt><dd>{watch.caseMm == null ? "est. " + estimateCaseMm(watch) + " mm" : formatMm(watch.caseMm)}</dd></div>
                    <div><dt>Thickness</dt><dd>{formatMm(watch.thicknessMm)}</dd></div>
                    <div><dt>Lug width</dt><dd>{formatMm(watch.lugWidthMm)}</dd></div>
                  </dl>
                  {fit && <p className="small">{fit.guidance}</p>}
                </article>
              );
            })}
          </div>
        )}
        {selected.length > 0 && (
          <div className="compare-share">
            <button className="button secondary" onClick={copyLink} type="button">
              <Copy size={15} aria-hidden="true" /> {copied ? "Link copied" : "Copy link to this comparison"}
            </button>
            <code>{shareHref}</code>
          </div>
        )}
      </section>
    </div>
  );
}

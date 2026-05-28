import { useState } from "react";
import type { ComponentProps } from "react";
import type { WatchWithSources } from "@/types";
import { formatMm } from "@/lib/watch";

type State = "idle" | "submitting" | "success" | "error";

interface Props {
  watch: WatchWithSources;
}

function displayMm(value: number | null | undefined): string {
  return value == null ? "Not provided" : formatMm(value);
}

function numberValue(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

export default function CorrectionReportForm({ watch }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  const submit: ComponentProps<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const issueType = String(formData.get("issueType") ?? "").trim();
    const issueDetails = String(formData.get("issueDetails") ?? "").trim();
    formData.set(
      "privateComment",
      [`Correction report: ${issueType || "Wrong data"}`, issueDetails].filter(Boolean).join("\n\n")
    );

    const response = await fetch("/api/submissions", {
      method: "POST",
      body: formData
    });
    const data = (await response.json()) as { message?: string; errors?: Record<string, string> };

    if (response.ok) {
      form.reset();
      setState("success");
      setMessage("Thanks. The report was sent for operator review.");
    } else {
      setState("error");
      setMessage(data.message ?? Object.values(data.errors ?? {})[0] ?? "Report failed.");
    }
  };

  if (!isOpen) {
    return (
      <div className="panel">
        <h2>Found wrong data?</h2>
        <p className="small">Send a correction report for operator review.</p>
        <button className="button secondary" type="button" onClick={() => setIsOpen(true)} style={{ marginTop: "14px" }}>
          Report wrong data
        </button>
      </div>
    );
  }

  return (
    <form className="panel form-grid correction-form" onSubmit={submit}>
      <input type="hidden" name="submissionType" value="correction" />
      <input type="hidden" name="reportedWatchId" value={watch.id} />
      <input type="hidden" name="reportedWatchPath" value={`/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`} />
      <input type="hidden" name="brand" value={watch.brand} />
      <input type="hidden" name="model" value={watch.model} />
      <input type="hidden" name="reference" value={watch.reference} />
      <input type="hidden" name="sourceUrl" value={watch.sources[0]?.sourceUrl ?? ""} />

      <div className="form-field full">
        <h2>Report wrong data</h2>
        <p className="small">Current values: lug-to-lug {displayMm(watch.lugToLugMm)}, case {displayMm(watch.caseMm)}, thickness {displayMm(watch.thicknessMm)}, lug width {displayMm(watch.lugWidthMm)}</p>
        <button className="button secondary" type="button" onClick={() => setIsOpen(false)} style={{ marginTop: "14px" }}>
          Hide form
        </button>
      </div>

      <div className="form-field full">
        <label htmlFor="issueType">What looks wrong?</label>
        <select className="select" id="issueType" name="issueType" defaultValue="Dimension is wrong">
          <option>Dimension is wrong</option>
          <option>Reference or model is wrong</option>
          <option>Source is unreliable</option>
          <option>Duplicate or mismatched watch</option>
          <option>Other</option>
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="lugToLugMm">Correct lug-to-lug mm</label>
        <input className="input" id="lugToLugMm" inputMode="decimal" min="20" max="80" name="lugToLugMm" step="0.1" type="number" defaultValue={numberValue(watch.lugToLugMm)} required />
      </div>
      <div className="form-field">
        <label htmlFor="caseMm">Correct case mm</label>
        <input className="input" id="caseMm" inputMode="decimal" min="20" max="60" name="caseMm" step="0.1" type="number" defaultValue={numberValue(watch.caseMm)} />
      </div>
      <div className="form-field">
        <label htmlFor="thicknessMm">Correct thickness mm</label>
        <input className="input" id="thicknessMm" inputMode="decimal" min="4" max="25" name="thicknessMm" step="0.1" type="number" defaultValue={numberValue(watch.thicknessMm)} />
      </div>
      <div className="form-field">
        <label htmlFor="lugWidthMm">Correct lug width mm</label>
        <input className="input" id="lugWidthMm" inputMode="decimal" min="8" max="30" name="lugWidthMm" step="0.1" type="number" defaultValue={numberValue(watch.lugWidthMm)} />
      </div>

      <div className="form-field full">
        <label htmlFor="issueDetails">Details</label>
        <textarea className="textarea" id="issueDetails" maxLength={900} name="issueDetails" placeholder="Add a source, measurement note, or what should be corrected." required />
      </div>

      <div className="form-field full">
        <label htmlFor="contactEmail">Email for follow-up, optional</label>
        <input className="input" id="contactEmail" maxLength={320} name="contactEmail" type="email" />
      </div>

      <div className="form-field full">
        <button className="button accent" type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "Sending..." : "Send report"}
        </button>
        {message && <p className={state === "error" ? "error" : "notice"}>{message}</p>}
      </div>
    </form>
  );
}

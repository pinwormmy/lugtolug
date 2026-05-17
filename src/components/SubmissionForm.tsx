import { useState } from "react";
import type { ComponentProps } from "react";

type State = "idle" | "submitting" | "success" | "error";

export default function SubmissionForm() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  const submit: ComponentProps<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    setState("submitting");
    const form = event.currentTarget;
    const response = await fetch("/api/submissions", {
      method: "POST",
      body: new FormData(form)
    });
    const data = (await response.json()) as { message?: string; errors?: Record<string, string> };
    if (response.ok) {
      form.reset();
      setMessage(data.message ?? "Submission received.");
      setState("success");
    } else {
      setMessage(data.message ?? Object.values(data.errors ?? {})[0] ?? "Submission failed.");
      setState("error");
    }
  };

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input
          autoComplete="off"
          id="website"
          name="website"
          tabIndex={-1}
          type="text"
        />
      </div>
      <div className="form-field">
        <label htmlFor="brand">Brand</label>
        <input autoComplete="organization" className="input" id="brand" maxLength={80} name="brand" required />
      </div>
      <div className="form-field">
        <label htmlFor="model">Model</label>
        <input className="input" id="model" maxLength={120} name="model" required />
      </div>
      <div className="form-field">
        <label htmlFor="reference">Reference number</label>
        <input className="input" id="reference" maxLength={80} name="reference" required />
      </div>
      <div className="form-field">
        <label htmlFor="sourceUrl">Source URL</label>
        <input className="input" id="sourceUrl" maxLength={2048} name="sourceUrl" type="url" required />
      </div>
      <div className="form-field">
        <label htmlFor="lugToLugMm">Lug-to-lug mm</label>
        <input className="input" id="lugToLugMm" max="80" min="20" name="lugToLugMm" inputMode="decimal" required step="0.1" type="number" />
      </div>
      <div className="form-field">
        <label htmlFor="diameterMm">Case diameter mm</label>
        <input className="input" id="diameterMm" max="60" min="20" name="diameterMm" inputMode="decimal" required step="0.1" type="number" />
      </div>
      <div className="form-field">
        <label htmlFor="thicknessMm">Thickness mm</label>
        <input className="input" id="thicknessMm" max="25" min="4" name="thicknessMm" inputMode="decimal" required step="0.1" type="number" />
      </div>
      <div className="form-field">
        <label htmlFor="lugWidthMm">Lug width mm</label>
        <input className="input" id="lugWidthMm" max="30" min="8" name="lugWidthMm" inputMode="decimal" required step="0.1" type="number" />
      </div>
      <div className="form-field full">
        <label htmlFor="privateComment">Private comment to operator</label>
        <textarea className="textarea" id="privateComment" maxLength={1000} name="privateComment" />
      </div>
      <div className="form-field full">
        <label htmlFor="contactEmail">Email for follow-up, optional</label>
        <input className="input" id="contactEmail" maxLength={320} name="contactEmail" type="email" />
      </div>
      <div className="form-field full">
        <button className="button accent" type="submit" disabled={state === "submitting"}>
          {state === "submitting" ? "Submitting..." : "Submit for review"}
        </button>
        {message && <p className={state === "error" ? "error" : "notice"}>{message}</p>}
      </div>
    </form>
  );
}

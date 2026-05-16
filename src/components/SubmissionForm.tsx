import { useState } from "react";
import type { FormEvent } from "react";

type State = "idle" | "submitting" | "success" | "error";

export default function SubmissionForm() {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
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
  }

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <div className="form-field">
        <label htmlFor="brand">Brand</label>
        <input className="input" id="brand" name="brand" required />
      </div>
      <div className="form-field">
        <label htmlFor="model">Model</label>
        <input className="input" id="model" name="model" required />
      </div>
      <div className="form-field">
        <label htmlFor="reference">Reference number</label>
        <input className="input" id="reference" name="reference" required />
      </div>
      <div className="form-field">
        <label htmlFor="sourceUrl">Source URL</label>
        <input className="input" id="sourceUrl" name="sourceUrl" type="url" required />
      </div>
      <div className="form-field">
        <label htmlFor="lugToLugMm">Lug-to-lug mm</label>
        <input className="input" id="lugToLugMm" name="lugToLugMm" inputMode="decimal" required />
      </div>
      <div className="form-field">
        <label htmlFor="diameterMm">Case diameter mm</label>
        <input className="input" id="diameterMm" name="diameterMm" inputMode="decimal" required />
      </div>
      <div className="form-field">
        <label htmlFor="thicknessMm">Thickness mm</label>
        <input className="input" id="thicknessMm" name="thicknessMm" inputMode="decimal" required />
      </div>
      <div className="form-field">
        <label htmlFor="lugWidthMm">Lug width mm</label>
        <input className="input" id="lugWidthMm" name="lugWidthMm" inputMode="decimal" required />
      </div>
      <div className="form-field full">
        <label htmlFor="privateComment">Private comment to operator</label>
        <textarea className="textarea" id="privateComment" name="privateComment" />
      </div>
      <div className="form-field full">
        <label htmlFor="contactEmail">Email for follow-up, optional</label>
        <input className="input" id="contactEmail" name="contactEmail" type="email" />
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

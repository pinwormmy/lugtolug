import { useState } from "react";
import type { ComponentProps } from "react";
import { OPTIONAL_SUBMISSION_FIELDS, OPTIONAL_TEXT_INPUTS, REQUIRED_NUMBER_INPUTS, REQUIRED_SUBMISSION_FIELDS, REQUIRED_TEXT_INPUTS } from "@/lib/submissionFields";

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
      {REQUIRED_TEXT_INPUTS.map((field) => (
        <div className="form-field" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            autoComplete={field.autoComplete}
            className="input"
            id={field.name}
            maxLength={field.maxLength}
            name={field.name}
            required={REQUIRED_SUBMISSION_FIELDS.has(field.name)}
            type={field.type ?? "text"}
          />
        </div>
      ))}
      {REQUIRED_NUMBER_INPUTS.map((field) => (
        <div className="form-field" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            className="input"
            id={field.name}
            inputMode="decimal"
            max={field.max}
            min={field.min}
            name={field.name}
            required={REQUIRED_SUBMISSION_FIELDS.has(field.name)}
            step="0.1"
            type="number"
          />
        </div>
      ))}
      {OPTIONAL_TEXT_INPUTS.map((field) => (
        <div className="form-field full" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <input
            autoComplete={field.autoComplete}
            className="input"
            id={field.name}
            maxLength={field.maxLength}
            name={field.name}
            type={field.type}
          />
        </div>
      ))}
      <div className="form-field full">
        <label htmlFor={OPTIONAL_SUBMISSION_FIELDS.privateComment.name}>{OPTIONAL_SUBMISSION_FIELDS.privateComment.label}</label>
        <textarea
          className="textarea"
          id={OPTIONAL_SUBMISSION_FIELDS.privateComment.name}
          maxLength={OPTIONAL_SUBMISSION_FIELDS.privateComment.maxLength}
          name={OPTIONAL_SUBMISSION_FIELDS.privateComment.name}
        />
      </div>
      <div className="form-field full">
        <label htmlFor={OPTIONAL_SUBMISSION_FIELDS.contactEmail.name}>{OPTIONAL_SUBMISSION_FIELDS.contactEmail.label}</label>
        <input
          className="input"
          id={OPTIONAL_SUBMISSION_FIELDS.contactEmail.name}
          maxLength={OPTIONAL_SUBMISSION_FIELDS.contactEmail.maxLength}
          name={OPTIONAL_SUBMISSION_FIELDS.contactEmail.name}
          type={OPTIONAL_SUBMISSION_FIELDS.contactEmail.type}
        />
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

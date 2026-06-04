import type { ComponentProps } from "react";
import { useSubmissionForm } from "@/hooks/useSubmissionForm";
import {
  OPTIONAL_PUBLIC_TEXT_INPUTS,
  OPTIONAL_SUBMISSION_FIELDS,
  OPTIONAL_TEXT_INPUTS,
  PUBLIC_SUBMISSION_TEXT_INPUTS,
  REQUIRED_NUMBER_INPUTS,
  REQUIRED_SUBMISSION_FIELDS
} from "@/lib/submissionFields";

export default function SubmissionForm() {
  const { state, message, submit } = useSubmissionForm("Submission failed.");

  const onSubmit: ComponentProps<"form">["onSubmit"] = async (event) => {
    event.preventDefault();
    if (await submit(new FormData(event.currentTarget))) {
      window.location.href = "/";
    }
  };

  return (
    <form className="panel form-grid" onSubmit={onSubmit}>
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
      {PUBLIC_SUBMISSION_TEXT_INPUTS.map((field) => (
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
      {OPTIONAL_PUBLIC_TEXT_INPUTS.map((field) => (
        <div className="form-field" key={field.name}>
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

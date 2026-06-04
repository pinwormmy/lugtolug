import { useState } from "react";

type SubmissionState = "idle" | "submitting" | "success" | "error";

interface SubmissionResponse {
  message?: string;
  errors?: Record<string, string>;
}

export function getSubmissionErrorMessage(data: SubmissionResponse, fallback: string): string {
  return data.message ?? Object.values(data.errors ?? {})[0] ?? fallback;
}

export function useSubmissionForm(errorFallback: string) {
  const [state, setState] = useState<SubmissionState>("idle");
  const [message, setMessage] = useState("");

  async function submit(formData: FormData): Promise<boolean> {
    setState("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as SubmissionResponse;
      if (!response.ok) {
        setState("error");
        setMessage(getSubmissionErrorMessage(data, errorFallback));
        return false;
      }

      setState("success");
      return true;
    } catch {
      setState("error");
      setMessage(errorFallback);
      return false;
    }
  }

  function showSuccess(message: string) {
    setState("success");
    setMessage(message);
  }

  return { state, message, submit, showSuccess };
}

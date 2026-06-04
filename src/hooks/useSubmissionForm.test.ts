import { describe, expect, it } from "vitest";
import { getSubmissionErrorMessage } from "@/hooks/useSubmissionForm";

describe("submission form errors", () => {
  it("prefers the API message", () => {
    expect(getSubmissionErrorMessage({ message: "Wait before trying again.", errors: { model: "Required" } }, "Failed."))
      .toBe("Wait before trying again.");
  });

  it("falls back to the first field error", () => {
    expect(getSubmissionErrorMessage({ errors: { model: "Required" } }, "Failed.")).toBe("Required");
  });

  it("uses the local fallback when the API has no details", () => {
    expect(getSubmissionErrorMessage({}, "Failed.")).toBe("Failed.");
  });
});

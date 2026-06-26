import { describe, expect, it } from "vitest";
import { compactReference, getReferenceProductIdentity, hasProductNumberIdentity } from "@/lib/watchIdentity";

describe("watch product identity", () => {
  it("matches formatted and unformatted product numbers", () => {
    expect(compactReference("T120.407.11.051.00")).toBe("T1204071105100");
    expect(getReferenceProductIdentity({ brandSlug: "tissot", reference: "T120.407.11.051.00" })).toBe(
      getReferenceProductIdentity({ brandSlug: "tissot", reference: "T1204071105100" })
    );
  });

  it("does not create product identities from name-only references", () => {
    expect(hasProductNumberIdentity("Dive")).toBe(false);
    expect(getReferenceProductIdentity({ brandSlug: "doxa", reference: "SUB 200 T-Graph II" })).toBe(
      "doxa|SUB200TGRAPHII"
    );
    expect(getReferenceProductIdentity({ brandSlug: "nomos", reference: "Metro" })).toBeNull();
  });
});

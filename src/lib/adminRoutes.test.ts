import { describe, expect, it } from "vitest";
import { getManagePublishedWatchHref } from "@/lib/adminRoutes";

describe("admin routes", () => {
  it("opens the slug-based manage page from the public manage link", () => {
    expect(
      getManagePublishedWatchHref({
        brandSlug: "omega",
        modelSlug: "speedmaster-professional",
        referenceSlug: "310-30-42-50-01-001"
      })
    ).toBe("/admin/watches/manage/omega/speedmaster-professional/310-30-42-50-01-001");
  });
});

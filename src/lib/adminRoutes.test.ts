import { describe, expect, it } from "vitest";
import { getManagePublishedWatchHref } from "@/lib/adminRoutes";

describe("admin routes", () => {
  it("opens the watch edit page from the public manage link", () => {
    expect(getManagePublishedWatchHref(42)).toBe("/admin/watches/42");
  });
});

import { describe, expect, it } from "vitest";
import { resolveLegacyBrandHref, resolveLegacyWatchHref } from "@/lib/legacyRoutes";
import { seedWatches } from "@/lib/seed";

describe("legacy route redirects", () => {
  it("maps pre-transliteration brand slugs to the current brand page", () => {
    expect(resolveLegacyBrandHref("glash-tte-original")).toBe("/brands/glashutte-original");
    expect(resolveLegacyBrandHref("herm-s")).toBe("/brands/hermes");
    expect(resolveLegacyBrandHref("a-lange-and-s-hne")).toBe("/brands/a-lange-and-sohne");
    expect(resolveLegacyBrandHref("rolex")).toBeNull();
    expect(resolveLegacyBrandHref("nope")).toBeNull();
  });

  it("maps pre-transliteration watch routes to the current watch page", () => {
    const watch = seedWatches.find((entry) => entry.brand === "Glashütte Original")!;
    const href = resolveLegacyWatchHref("glash-tte-original", watch.modelSlug, watch.referenceSlug);
    expect(href).toBe(`/watches/glashutte-original/${watch.modelSlug}/${watch.referenceSlug}`);
    expect(resolveLegacyWatchHref("rolex", "submariner-date", "126610ln")).toBeNull();
  });
});

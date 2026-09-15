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

  it("maps the routes of renamed watches to their current page", () => {
    // Borealis 5508 was published as "씨스톰 GMT '판다' 넌데이트" before its English name.
    expect(resolveLegacyWatchHref("borealis", "gmt", "gmt-iw353")).toBe(
      "/watches/borealis/seastorm-gmt-panda-non-date/seastorm-gmt-panda-non-date-iw353"
    );
    expect(resolveLegacyWatchHref("nth", "v2", "v2-iw292")).toBe("/watches/nth/upholder-v2-non-date/upholder-v2-non-date-iw292");
  });

  it("keeps every route of a watch renamed more than once", () => {
    // WMT 5799 was "루파스 밀스펙 MK1 세트", then "Lupus Milspec MK1 Set", before the brand spelling.
    const current = "/watches/wmt/lupas-mil-spec-mki-set/lupas-mil-spec-mki-set-iw431";
    expect(resolveLegacyWatchHref("wmt", "mk1", "mk1-iw431")).toBe(current);
    expect(resolveLegacyWatchHref("wmt", "lupus-milspec-mk1-set", "lupus-milspec-mk1-set-iw431")).toBe(current);
    expect(resolveLegacyWatchHref("wmt", "ember-aging-edition", "ember-aging-edition-iw274")).toBe(
      "/watches/wmt/ember-aged-edition/ember-aged-edition-iw274"
    );
  });
});

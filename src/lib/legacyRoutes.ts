import legacyRoutes from "../../data/legacy-routes.json";
import { seedWatches } from "@/lib/seed";
import { getWatchHref } from "@/lib/watch";
import { legacySlugify } from "@/lib/watchText";

// Two kinds of old URL redirect (301) to the current page instead of 404ing:
// - slugs used to drop accented letters (Glashütte Original -> glash-tte-original),
//   derived here from the seed names with the old rule;
// - watches whose names were corrected after publication (data/legacy-routes.json,
//   keyed by watch id with the slugs the record carried before).
// The maps hold only records whose slug actually changed, built once per isolate.

type LegacySlugs = { brandSlug: string; modelSlug: string; referenceSlug: string };
// A record renamed more than once lists every route it carried before, oldest first.
const RENAMED_WATCH_SLUGS: Record<string, LegacySlugs | LegacySlugs[]> = legacyRoutes.watches;

let watchRedirects: Map<string, string> | null = null;
let brandRedirects: Map<string, string> | null = null;

function legacyWatchSlugs(watch: { brand: string; model: string; reference: string }) {
  return {
    brandSlug: legacySlugify(watch.brand) || "unknown-brand",
    modelSlug: legacySlugify(watch.model) || legacySlugify(watch.reference) || "watch",
    referenceSlug: legacySlugify(watch.reference) || "no-reference"
  };
}

function buildRedirects(): void {
  watchRedirects = new Map();
  brandRedirects = new Map();

  for (const watch of seedWatches) {
    const renamed = RENAMED_WATCH_SLUGS[String(watch.id)];
    for (const previous of renamed ? [renamed].flat() : []) {
      const renamedKey = `${previous.brandSlug}/${previous.modelSlug}/${previous.referenceSlug}`;
      if (!watchRedirects.has(renamedKey)) watchRedirects.set(renamedKey, getWatchHref(watch));
    }

    const legacy = legacyWatchSlugs(watch);
    const legacyKey = `${legacy.brandSlug}/${legacy.modelSlug}/${legacy.referenceSlug}`;
    const currentKey = `${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
    if (legacyKey !== currentKey && !watchRedirects.has(legacyKey)) {
      watchRedirects.set(legacyKey, getWatchHref(watch));
    }
    if (legacy.brandSlug !== watch.brandSlug && !brandRedirects.has(legacy.brandSlug)) {
      brandRedirects.set(legacy.brandSlug, `/brands/${watch.brandSlug}`);
    }
  }
}

/** Current href for a watch route that used the pre-transliteration slugs, or null. */
export function resolveLegacyWatchHref(brandSlug: string, modelSlug: string, referenceSlug: string): string | null {
  if (!watchRedirects) buildRedirects();
  return watchRedirects!.get(`${brandSlug}/${modelSlug}/${referenceSlug}`) ?? null;
}

/** Current href for a brand route that used the pre-transliteration slug, or null. */
export function resolveLegacyBrandHref(brandSlug: string): string | null {
  if (!brandRedirects) buildRedirects();
  return brandRedirects!.get(brandSlug) ?? null;
}

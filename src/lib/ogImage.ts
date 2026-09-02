import type { Watch } from "@/types";
import { seedWatches } from "@/lib/seed";
import { OG_HEIGHT, OG_WIDTH } from "@/lib/ogCard";

// Public paths of the Open Graph cards generated at build time from the seed
// catalog (see src/integrations/ogImages.ts). D1-only records have no card
// yet, so they fall back to the site-wide image.

export const OG_IMAGE_WIDTH = OG_WIDTH;
export const OG_IMAGE_HEIGHT = OG_HEIGHT;
export const DEFAULT_OG_IMAGE_PATH = "/og/default.png";

type WatchKeyParts = Pick<Watch, "brandSlug" | "modelSlug" | "referenceSlug">;

export function getWatchOgImagePath(watch: WatchKeyParts): string {
  return `/og/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}.png`;
}

export function getBrandOgImagePath(brandSlug: string): string {
  return `/og/brands/${brandSlug}.png`;
}

let seedWatchKeys: Set<string> | null = null;
let seedBrandSlugs: Set<string> | null = null;

function watchKey(watch: WatchKeyParts): string {
  return `${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`;
}

export function resolveWatchOgImage(watch: WatchKeyParts): string {
  seedWatchKeys ??= new Set(seedWatches.map(watchKey));
  return seedWatchKeys.has(watchKey(watch)) ? getWatchOgImagePath(watch) : DEFAULT_OG_IMAGE_PATH;
}

export function resolveBrandOgImage(brandSlug: string): string {
  seedBrandSlugs ??= new Set(seedWatches.map((watch) => watch.brandSlug));
  return seedBrandSlugs.has(brandSlug) ? getBrandOgImagePath(brandSlug) : DEFAULT_OG_IMAGE_PATH;
}

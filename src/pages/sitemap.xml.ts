import type { APIRoute } from "astro";
import { getDb, listSearchWatches } from "@/lib/db";
import { getEdgeCache } from "@/lib/http";
import { getWatchHref } from "@/lib/watch";
import { resolveOrigin } from "@/lib/seo";
import {
  LUG_TO_LUG_COLLECTIONS,
  WATCH_GENRES,
  WRIST_SIZES,
  getLugToLugLimitHref,
  getWristGuideHref
} from "@/lib/wristGuide";

// Search engines fetch the sitemap several times a day; a 24h edge cache keeps
// those fetches from re-reading the whole catalog out of D1 on every request.
const CACHE_CONTROL = "public, max-age=86400";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

/** Normalize a stored timestamp to a W3C date (YYYY-MM-DD), or omit if unparseable. */
function toLastmod(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return match ? match[0] : undefined;
}

export const GET: APIRoute = async ({ locals, site, request }) => {
  const cache = getEdgeCache();
  const cacheKey = new Request(new URL("/sitemap.xml", request.url), { method: "GET" });

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const origin = resolveOrigin(site);
  // The sitemap never renders sources, so the summary list skips hydrating them.
  const watches = await listSearchWatches(getDb(locals));

  const brandLastmod = new Map<string, string | undefined>();
  for (const watch of watches) {
    const lastmod = toLastmod(watch.updatedAt);
    const current = brandLastmod.get(watch.brandSlug);
    if (!brandLastmod.has(watch.brandSlug) || (lastmod && (!current || lastmod > current))) {
      brandLastmod.set(watch.brandSlug, lastmod);
    }
  }

  const entries: SitemapEntry[] = [
    { path: "", changefreq: "daily", priority: "1.0" },
    { path: "/watches", changefreq: "daily", priority: "0.9" },
    { path: "/submit", changefreq: "monthly", priority: "0.3" },
    { path: "/wrist", changefreq: "weekly", priority: "0.7" },
    { path: "/compare", changefreq: "monthly", priority: "0.6" },
    ...WRIST_SIZES.map((size) => ({ path: getWristGuideHref(size), changefreq: "weekly", priority: "0.7" })),
    ...WRIST_SIZES.flatMap((size) =>
      WATCH_GENRES.map((genre) => ({ path: getWristGuideHref(size, genre), changefreq: "weekly", priority: "0.6" }))
    ),
    ...LUG_TO_LUG_COLLECTIONS.map((limit) => ({ path: getLugToLugLimitHref(limit), changefreq: "weekly", priority: "0.7" })),
    ...[...brandLastmod.entries()].map(([brandSlug, lastmod]) => ({
      path: `/brands/${brandSlug}`,
      lastmod,
      changefreq: "weekly",
      priority: "0.6"
    })),
    ...watches.map((watch) => ({
      path: getWatchHref(watch),
      lastmod: toLastmod(watch.updatedAt),
      changefreq: "monthly",
      priority: "0.7"
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => {
    const parts = [`<loc>${origin}${entry.path}</loc>`];
    if (entry.lastmod) parts.push(`<lastmod>${entry.lastmod}</lastmod>`);
    if (entry.changefreq) parts.push(`<changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) parts.push(`<priority>${entry.priority}</priority>`);
    return `  <url>${parts.join("")}</url>`;
  })
  .join("\n")}
</urlset>`;

  const response = new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": CACHE_CONTROL
    }
  });

  if (cache) await cache.put(cacheKey, response.clone());
  return response;
};

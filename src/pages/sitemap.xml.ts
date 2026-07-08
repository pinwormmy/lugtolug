import type { APIRoute } from "astro";
import { getDb, listWatches } from "@/lib/db";
import { getWatchHref } from "@/lib/watch";
import { resolveOrigin } from "@/lib/seo";

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

export const GET: APIRoute = async ({ locals, site }) => {
  const origin = resolveOrigin(site);
  const watches = await listWatches(getDb(locals));

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

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
};

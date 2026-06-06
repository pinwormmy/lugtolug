import type { APIRoute } from "astro";
import { getDb, listWatches } from "@/lib/db";

export const GET: APIRoute = async ({ locals, site }) => {
  const origin = site?.toString().replace(/\/$/, "") ?? "https://lugtolug.pages.dev";
  const watches = await listWatches(getDb(locals));
  const urls = [
    "",
    "/watches",
    "/submit",
    ...new Set(watches.map((watch) => `/brands/${watch.brandSlug}`)),
    ...watches.map((watch) => `/watches/${watch.brandSlug}/${watch.modelSlug}/${watch.referenceSlug}`)
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${origin}${url}</loc></url>`).join("\n")}
</urlset>`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" }
  });
};

import type { APIRoute } from "astro";
import { resolveOrigin } from "@/lib/seo";

export const GET: APIRoute = ({ site }) => {
  const origin = resolveOrigin(site);
  // Admin pages use a noindex meta tag, so crawlers must be able to visit them
  // to see that directive. Only non-page API routes need crawl blocking here.
  const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
};

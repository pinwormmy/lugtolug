import type { APIRoute } from "astro";
import { resolveOrigin } from "@/lib/seo";

export const GET: APIRoute = ({ site }) => {
  const origin = resolveOrigin(site);
  const body = ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join(
    "\n"
  );
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
};

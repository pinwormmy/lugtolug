import type { APIRoute } from "astro";
import { getDb, listSearchWatches } from "@/lib/db";
import { json } from "@/lib/http";

const CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

function getEdgeCache(): Cache | undefined {
  if (typeof caches === "undefined") return undefined;
  return (caches as unknown as { default?: Cache }).default;
}

export const GET: APIRoute = async ({ locals, request }) => {
  const cache = getEdgeCache();
  const cacheKey = new Request(new URL("/api/watches.json", request.url), { method: "GET" });

  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }

  const watches = await listSearchWatches(getDb(locals));
  const response = json({ watches }, { headers: { "cache-control": CACHE_CONTROL } });

  if (cache) await cache.put(cacheKey, response.clone());
  return response;
};

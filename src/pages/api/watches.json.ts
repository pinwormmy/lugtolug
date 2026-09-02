import type { APIRoute } from "astro";
import { getDb, listSearchWatches } from "@/lib/db";
import { getEdgeCache, json } from "@/lib/http";

// The catalog changes only when a record is approved; an hour of staleness is
// fine and cuts the ~7k-row rebuild to once per colo per hour.
const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400";

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

import type { APIRoute } from "astro";
import { getDb, searchWatches } from "@/lib/db";
import { json } from "@/lib/http";

// Longer strings never match a watch; the cap keeps the D1 LIKE query bounded.
const MAX_QUERY_LENGTH = 100;

export const GET: APIRoute = async ({ locals, url }) => {
  const q = (url.searchParams.get("q") ?? "").slice(0, MAX_QUERY_LENGTH);
  const watches = await searchWatches(getDb(locals), q);
  return json({ watches });
};

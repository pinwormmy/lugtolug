import type { APIRoute } from "astro";
import { getDb, searchWatches } from "@/lib/db";
import { json } from "@/lib/http";

export const GET: APIRoute = async ({ locals, url }) => {
  const q = url.searchParams.get("q") ?? "";
  const watches = await searchWatches(getDb(locals), q);
  return json({ watches });
};

import { SITE_URL } from "@/lib/seo";

/** Cloudflare's non-standard default cache; absent in dev/test runtimes. */
export function getEdgeCache(): Cache | undefined {
  if (typeof caches === "undefined") return undefined;
  return (caches as unknown as { default?: Cache }).default;
}

/** Cache key for an internal, never-routed lookup (the URL only needs to be unique). */
export function internalCacheKey(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`/__internal/${path}`, SITE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Serve a small JSON-serialisable lookup from the edge cache for `maxAgeSeconds`,
 * loading it once per colo per window. Keeps crawler traffic from repeating the
 * same D1 reads on every page render (the free tier counts scanned rows daily).
 */
export async function withEdgeCachedJson<T>(key: string, maxAgeSeconds: number, load: () => Promise<T>): Promise<T> {
  const cache = getEdgeCache();
  const request = new Request(key, { method: "GET" });

  if (cache) {
    const cached = await cache.match(request);
    if (cached) return (await cached.json()) as T;
  }

  const value = await load();

  if (cache) {
    await cache.put(
      request,
      new Response(JSON.stringify(value), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${maxAgeSeconds}`
        }
      })
    );
  }
  return value;
}

/**
 * Parse a form body, or return null when it is not a valid form submission
 * (wrong content type, broken multipart boundary). `request.formData()` throws
 * on those, which would otherwise surface as a 500 page.
 */
export async function readFormData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {})
    }
  });
}

export function redirect(location: string, headers: HeadersInit = {}) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      ...headers
    }
  });
}

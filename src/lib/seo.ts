/** Human-readable site name used in titles, Open Graph, and structured data. */
export const SITE_NAME = "Lug to Lug Finder";

/**
 * Canonical production origin. Also the runtime fallback when `Astro.site`
 * is unavailable (e.g. a build environment without PUBLIC_SITE_URL).
 */
export const SITE_URL = "https://lugtolugfinder.com";

export const DEFAULT_DESCRIPTION =
  "Look up lug-to-lug, case diameter, thickness, and lug width for thousands of watches, with wrist-fit guidance and cited sources.";

/** Google Search Console verification token, rendered site-wide by BaseLayout. */
export const GOOGLE_SITE_VERIFICATION = "sRDq2qTrJwd7gYcwaSBzNrIXs1h0W0E7Ela0tJaQDW0";

/** Origin (scheme + host, no trailing slash) for the current request. */
export function resolveOrigin(site?: URL | string | null): string {
  const value = site?.toString() ?? SITE_URL;
  return value.replace(/\/$/, "");
}

/** Absolute URL for a site-relative path, given an origin. */
export function absoluteUrl(origin: string, path: string): string {
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Redirect the optional www alias to the configured apex canonical host. */
export function getCanonicalHostRedirect(url: URL, canonicalOrigin = SITE_URL): URL | null {
  const canonical = new URL(canonicalOrigin);
  const apexHost = canonical.hostname.replace(/^www\./, "");

  if (canonical.hostname !== apexHost || url.hostname !== `www.${apexHost}`) return null;

  const redirectUrl = new URL(url);
  redirectUrl.protocol = canonical.protocol;
  redirectUrl.host = canonical.host;
  return redirectUrl;
}

/**
 * Redirect `/path/` to `/path` so each page has one indexable URL. Both forms
 * rendered the same page with a self-referencing canonical, which search engines
 * treat as duplicate content. The root and non-page routes are left alone.
 */
export function getTrailingSlashRedirect(url: URL): URL | null {
  if (url.pathname === "/" || !url.pathname.endsWith("/")) return null;

  const redirectUrl = new URL(url);
  redirectUrl.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return redirectUrl;
}

/**
 * Serialize structured data for an inline `<script type="application/ld+json">` block.
 * `JSON.stringify` leaves `<`, `>` and `&` untouched, so a stored value containing
 * `</script>` would close the block early and inject markup into the page. Encoding
 * those characters as JSON unicode escapes keeps the payload valid JSON-LD while
 * making it inert inside the script element.
 */
export function toJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? "null";
  return json
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** WebSite schema with a sitelinks search box wired to the homepage search. */
export function buildWebSiteSchema(origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${origin}/`,
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildOrganizationSchema(origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${origin}/`,
    logo: absoluteUrl(origin, "/favicon.svg")
  };
}

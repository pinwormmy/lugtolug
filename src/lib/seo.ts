/** Human-readable site name used in titles, Open Graph, and structured data. */
export const SITE_NAME = "Lug to Lug Finder";

/**
 * Canonical production origin. Also the runtime fallback when `Astro.site`
 * is unavailable (e.g. a build environment without PUBLIC_SITE_URL).
 */
export const SITE_URL = "https://lugtolugfinder.com";

export const DEFAULT_DESCRIPTION = "Search watch records by brand, model, and reference.";

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

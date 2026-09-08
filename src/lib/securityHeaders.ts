// Response hardening applied by src/middleware.ts to every server-rendered
// response. Static assets served straight from Cloudflare Pages get theirs from
// public/_headers instead.

/** Largest request body any form or JSON endpoint on this site needs. */
export const MAX_REQUEST_BODY_BYTES = 64 * 1024;

/**
 * Fallback policy for responses Astro did not already stamp with a CSP (JSON,
 * XML, redirects). Pages rendered by Astro carry a stricter hash-based
 * script-src generated at build time (see experimental.csp in astro.config.mjs).
 */
export const FALLBACK_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

// Layout tweaks in the templates use inline `style` attributes. A hash-based
// style-src ignores 'unsafe-inline', so attributes are allowed through the
// dedicated attribute directive (which Astro's config does not expose).
const STYLE_ATTR_DIRECTIVE = "style-src-attr 'unsafe-inline'";

const NO_STORE_PREFIXES = ["/admin", "/api/admin", "/api/submissions"];
const NO_INDEX_PREFIXES = ["/admin", "/api"];

/** Path-segment aware prefix test: "/admin" matches "/admin/login" but not "/administrator". */
function hasPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function withStyleAttributeDirective(csp: string): string {
  if (/style-src-attr/i.test(csp)) return csp;
  const trimmed = csp.trim();
  return `${trimmed}${trimmed.endsWith(";") ? "" : ";"} ${STYLE_ATTR_DIRECTIVE};`;
}

export interface SecurityHeaderOptions {
  /**
   * Whether to emit a Content-Security-Policy. Off in `astro dev`, where Astro
   * does not hash its scripts and Vite injects its own inline client code.
   */
  csp?: boolean;
}

export function setSecurityHeaders(headers: Headers, url: URL, options: SecurityHeaderOptions = {}): void {
  const { csp = true } = options;
  const existingCsp = headers.get("content-security-policy");
  if (csp) {
    headers.set("content-security-policy", existingCsp ? withStyleAttributeDirective(existingCsp) : FALLBACK_CSP);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  headers.set("cross-origin-opener-policy", "same-origin");

  if (url.protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  if (hasPrefix(url.pathname, NO_STORE_PREFIXES) && !headers.has("cache-control")) {
    headers.set("cache-control", "no-store");
  }

  if (hasPrefix(url.pathname, NO_INDEX_PREFIXES)) {
    headers.set("x-robots-tag", "noindex, nofollow");
  }
}

/**
 * Add the security headers to a response, copying it when its headers are
 * immutable (Response.redirect(), Cache API hits).
 */
export function applySecurityHeaders(response: Response, url: URL, options: SecurityHeaderOptions = {}): Response {
  try {
    setSecurityHeaders(response.headers, url, options);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    setSecurityHeaders(headers, url, options);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

/** True when a declared request body is larger than any endpoint here accepts. */
export function exceedsBodyLimit(request: Request, maxBytes = MAX_REQUEST_BODY_BYTES): boolean {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const declared = Number(request.headers.get("content-length"));
  return Number.isFinite(declared) && declared > maxBytes;
}

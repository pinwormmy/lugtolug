import { defineMiddleware } from "astro:middleware";
import { getDb } from "@/lib/db";
import { recordVisit } from "@/lib/db/visitors";
import { applySecurityHeaders, exceedsBodyLimit } from "@/lib/securityHeaders";
import { getCanonicalHostRedirect, getTrailingSlashRedirect } from "@/lib/seo";

// Astro only emits its hash-based CSP for built output; the dev server injects
// un-hashed inline scripts, so the policy is skipped there.
const HEADER_OPTIONS = { csp: import.meta.env.PROD };

export const onRequest = defineMiddleware(async (context, next) => {
  const harden = (response: Response) => applySecurityHeaders(response, context.url, HEADER_OPTIONS);

  const canonicalRedirect = getCanonicalHostRedirect(context.url) ?? getTrailingSlashRedirect(context.url);
  if (canonicalRedirect) return harden(Response.redirect(canonicalRedirect, 301));

  // Reject oversized uploads before any handler buffers them with formData().
  if (exceedsBodyLimit(context.request)) {
    return harden(new Response("Request body too large.", { status: 413 }));
  }

  // Record before rendering so the visitor counts on the page include this visit.
  if (isPageView(context.request, context.url)) {
    await recordVisit(getDb(context.locals), context.cookies, context.request);
  }
  return harden(await next());
});

function isPageView(request: Request, url: URL): boolean {
  if (request.method !== "GET") return false;
  if (url.pathname.startsWith("/api/")) return false;
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  exceedsBodyLimit,
  FALLBACK_CSP,
  MAX_REQUEST_BODY_BYTES,
  withStyleAttributeDirective
} from "@/lib/securityHeaders";

const pageUrl = new URL("https://lugtolugfinder.com/watches/rolex/explorer/124270");

describe("applySecurityHeaders", () => {
  it("adds the baseline headers to a rendered page", () => {
    const response = applySecurityHeaders(new Response("<html></html>", { headers: { "content-type": "text/html" } }), pageUrl);

    expect(response.headers.get("content-security-policy")).toBe(FALLBACK_CSP);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains");
    expect(response.headers.get("cache-control")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("keeps Astro's hash-based policy and allows inline style attributes", () => {
    const astroCsp = "default-src 'self'; script-src 'self' 'sha256-abc'; style-src 'self' 'sha256-def';";
    const response = applySecurityHeaders(
      new Response("", { headers: { "content-security-policy": astroCsp } }),
      pageUrl
    );

    expect(response.headers.get("content-security-policy")).toBe(`${astroCsp} style-src-attr 'unsafe-inline';`);
  });

  it("only sends HSTS over https", () => {
    const response = applySecurityHeaders(new Response(""), new URL("http://localhost:4321/"));

    expect(response.headers.get("strict-transport-security")).toBeNull();
    expect(response.headers.get("content-security-policy")).toBe(FALLBACK_CSP);
  });

  it("marks admin and submission responses as uncacheable and unindexable", () => {
    for (const path of ["/admin/login", "/admin", "/api/admin/login", "/api/submissions"]) {
      const response = applySecurityHeaders(new Response(""), new URL(path, pageUrl));
      expect(response.headers.get("cache-control"), path).toBe("no-store");
    }
    expect(applySecurityHeaders(new Response(""), new URL("/api/search?q=x", pageUrl)).headers.get("x-robots-tag")).toBe(
      "noindex, nofollow"
    );
    expect(applySecurityHeaders(new Response(""), new URL("/administrator", pageUrl)).headers.get("cache-control")).toBeNull();
  });

  it("respects an explicit cache-control set by the route", () => {
    const response = applySecurityHeaders(
      new Response("", { headers: { "cache-control": "private, max-age=60" } }),
      new URL("/admin/watches", pageUrl)
    );

    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("copies responses whose headers are immutable", () => {
    const redirect = Response.redirect("https://lugtolugfinder.com/watches", 301);
    const response = applySecurityHeaders(redirect, new URL("https://www.lugtolugfinder.com/watches"));

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("https://lugtolugfinder.com/watches");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("applySecurityHeaders without CSP (dev server)", () => {
  it("keeps the other headers but leaves the policy alone", () => {
    const response = applySecurityHeaders(new Response(""), pageUrl, { csp: false });

    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});

describe("withStyleAttributeDirective", () => {
  it("does not duplicate an existing directive", () => {
    const csp = "default-src 'self'; style-src-attr 'unsafe-inline';";
    expect(withStyleAttributeDirective(csp)).toBe(csp);
  });

  it("terminates a policy that lacks a trailing semicolon", () => {
    expect(withStyleAttributeDirective("default-src 'self'")).toBe("default-src 'self'; style-src-attr 'unsafe-inline';");
  });
});

describe("exceedsBodyLimit", () => {
  it("rejects declared bodies above the limit for write methods only", () => {
    const big = { "content-length": String(MAX_REQUEST_BODY_BYTES + 1) };

    expect(exceedsBodyLimit(new Request("https://example.com/api/submissions", { method: "POST", headers: big }))).toBe(true);
    expect(exceedsBodyLimit(new Request("https://example.com/api/search", { method: "GET", headers: big }))).toBe(false);
    expect(
      exceedsBodyLimit(
        new Request("https://example.com/api/submissions", {
          method: "POST",
          headers: { "content-length": String(MAX_REQUEST_BODY_BYTES) }
        })
      )
    ).toBe(false);
    expect(exceedsBodyLimit(new Request("https://example.com/api/submissions", { method: "POST" }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  absoluteUrl,
  buildOrganizationSchema,
  buildWebSiteSchema,
  resolveOrigin,
  SITE_URL
} from "@/lib/seo";

const origin = "https://lugtolugfinder.com";

describe("resolveOrigin", () => {
  it("strips a trailing slash", () => {
    expect(resolveOrigin("https://example.com/")).toBe("https://example.com");
  });

  it("falls back to the production site url", () => {
    expect(resolveOrigin(undefined)).toBe(SITE_URL);
    expect(resolveOrigin(null)).toBe(SITE_URL);
  });

  it("accepts a URL instance", () => {
    expect(resolveOrigin(new URL("https://staging.example.com"))).toBe("https://staging.example.com");
  });
});

describe("absoluteUrl", () => {
  it("joins origin and path", () => {
    expect(absoluteUrl(origin, "/watches")).toBe("https://lugtolugfinder.com/watches");
    expect(absoluteUrl(origin, "watches")).toBe("https://lugtolugfinder.com/watches");
  });
});

describe("buildWebSiteSchema", () => {
  it("wires the search action to the homepage query param", () => {
    const schema = buildWebSiteSchema(origin);
    expect(schema["@type"]).toBe("WebSite");
    const action = schema.potentialAction as { target: { urlTemplate: string } };
    expect(action.target.urlTemplate).toBe("https://lugtolugfinder.com/?q={search_term_string}");
  });
});

describe("buildOrganizationSchema", () => {
  it("points the logo at the favicon", () => {
    const schema = buildOrganizationSchema(origin);
    expect(schema.logo).toBe("https://lugtolugfinder.com/favicon.svg");
  });
});

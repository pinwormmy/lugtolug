import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import { ogImages } from "./src/integrations/ogImages.ts";

const site = process.env.PUBLIC_SITE_URL ?? "https://lugtolugfinder.com";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
    platformProxy: {
      enabled: true
    }
  }),
  image: {
    service: passthroughImageService()
  },
  integrations: [react(), ogImages()],
  site,
  experimental: {
    // Astro hashes its own inline hydration scripts and scoped styles at build
    // time and emits a Content-Security-Policy header for every rendered page.
    // src/middleware.ts adds the remaining headers (and style-src-attr for the
    // inline style attributes used in templates).
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
      ],
      styleDirective: { resources: ["'self'"] },
      scriptDirective: { resources: ["'self'"] }
    }
  }
});

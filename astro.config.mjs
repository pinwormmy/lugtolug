import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

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
  integrations: [react()],
  site
});

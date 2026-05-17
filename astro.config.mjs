import { defineConfig, passthroughImageService } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";

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
  site: "https://lugtolug.example"
});

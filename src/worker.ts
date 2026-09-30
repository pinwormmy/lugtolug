// Worker entry point (astro.config.mjs `workerEntryPoint`), identical to the
// adapter's default except for the seed import below.
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";
// Astro loads middleware and page modules with lazy import(), so without this the
// first request in every new isolate parses and builds the 8k-record seed catalog
// (~86 ms locally), which can count against that request's 10 ms free-plan CPU
// limit. Importing it here evaluates it in the Worker's global scope, under the
// 1 s startup limit instead.
import "@/lib/seed";

type HandleArgs = Parameters<typeof handle>;

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  const fetch = (request: HandleArgs[2], env: HandleArgs[3], context: HandleArgs[4]) =>
    handle(manifest, app, request, env, context);
  return { default: { fetch } };
}

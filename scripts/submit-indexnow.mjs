#!/usr/bin/env node
// Submit site URLs to IndexNow (Bing, Naver, Yandex, Seznam - Google does not consume IndexNow).
//
// Usage:
//   node scripts/submit-indexnow.mjs                          # submit every URL in the live sitemap
//   node scripts/submit-indexnow.mjs --dry-run                # show what would be submitted
//   node scripts/submit-indexnow.mjs /watches/rolex/submariner-date/126610ln
//                                                             # submit specific paths or absolute URLs
//
// The site origin defaults to https://lugtolugfinder.com and can be overridden
// with PUBLIC_SITE_URL. The IndexNow key is read from the public/<key>.txt file
// that the site serves at its root.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const MAX_URLS_PER_POST = 10000;

function findIndexNowKey() {
  for (const file of readdirSync(PUBLIC_DIR)) {
    const match = /^([a-f0-9]{16,64})\.txt$/.exec(file);
    if (!match) continue;
    const content = readFileSync(path.join(PUBLIC_DIR, file), "utf8").trim();
    if (content === match[1]) return content;
  }
  throw new Error("No IndexNow key file found in public/ (expected <key>.txt containing the key).");
}

async function fetchSitemapUrls(origin) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  const response = await fetch(sitemapUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${sitemapUrl}: HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const explicitTargets = args.filter((arg) => !arg.startsWith("--"));

  const origin = (process.env.PUBLIC_SITE_URL ?? "https://lugtolugfinder.com").replace(/\/$/, "");
  const key = findIndexNowKey();

  const urls = explicitTargets.length
    ? explicitTargets.map((target) => (target.startsWith("http") ? target : `${origin}${target}`))
    : await fetchSitemapUrls(origin);

  if (urls.length === 0) throw new Error("No URLs to submit.");

  // IndexNow requires every URL in a submission to live on the declared host,
  // so derive it from the URLs themselves (the sitemap may use a different
  // canonical origin than the one it was fetched from).
  const hosts = new Set(urls.map((url) => new URL(url).host));
  if (hosts.size > 1) throw new Error(`URLs span multiple hosts: ${[...hosts].join(", ")}`);
  const host = [...hosts][0];
  const keyOrigin = new URL(urls[0]).origin;
  console.log(`Submitting ${urls.length} URL(s) for ${host} via IndexNow${dryRun ? " (dry run)" : ""}`);

  for (let start = 0; start < urls.length; start += MAX_URLS_PER_POST) {
    const batch = urls.slice(start, start + MAX_URLS_PER_POST);
    if (dryRun) {
      console.log(batch.slice(0, 5).map((url) => `  ${url}`).join("\n"));
      if (batch.length > 5) console.log(`  ... and ${batch.length - 5} more`);
      continue;
    }
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${keyOrigin}/${key}.txt`,
        urlList: batch
      })
    });
    // IndexNow returns 200 or 202 on success.
    if (!response.ok) {
      throw new Error(`IndexNow rejected batch: HTTP ${response.status} ${await response.text()}`);
    }
    console.log(`  Batch of ${batch.length} accepted (HTTP ${response.status}).`);
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

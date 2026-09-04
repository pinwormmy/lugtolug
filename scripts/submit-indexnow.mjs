#!/usr/bin/env node
// Submit site URLs to IndexNow (Bing, Naver, Yandex, Seznam - Google does not consume IndexNow).
//
// Usage:
//   node scripts/submit-indexnow.mjs                          # submit every URL in the live sitemap
//   node scripts/submit-indexnow.mjs --dry-run                # show what would be submitted
//   node scripts/submit-indexnow.mjs /wrist /wrist/6-inch     # submit specific paths (one request)
//   node scripts/submit-indexnow.mjs https://lugtolugfinder.com/watches/rolex/submariner-date/126610ln
//                                                             # absolute URLs on the site origin also work
//
// Each path must start with "/". Several paths can be passed as separate
// arguments or inside one quoted argument ("/wrist /wrist/6-inch"); they are
// deduplicated and sent together in a single IndexNow request.
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

const KNOWN_FLAGS = new Set(["--dry-run"]);

// Turn CLI arguments into absolute URLs. Every non-flag argument is a target;
// an argument that contains whitespace is split into several targets so that
// `"/wrist /wrist/6-inch"` (paths joined by a shell or npm wrapper) does not
// become one bogus URL. Paths must start with "/"; absolute http(s) URLs are
// accepted as-is.
function parseArgs(argv, origin) {
  const flags = new Set();
  const targets = [];
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      if (!KNOWN_FLAGS.has(arg)) throw new Error(`Unknown flag: ${arg}`);
      flags.add(arg);
      continue;
    }
    for (const token of arg.split(/\s+/)) {
      if (token.length === 0) continue;
      targets.push(token);
    }
  }

  const urls = [];
  for (const target of targets) {
    if (/^https?:\/\//.test(target)) {
      urls.push(target);
    } else if (target.startsWith("/")) {
      urls.push(`${origin}${target}`);
    } else {
      throw new Error(`Invalid target "${target}": paths must start with "/" (e.g. /wrist/6-inch).`);
    }
  }

  return { dryRun: flags.has("--dry-run"), urls: [...new Set(urls)] };
}

async function main() {
  const origin = (process.env.PUBLIC_SITE_URL ?? "https://lugtolugfinder.com").replace(/\/$/, "");
  const { dryRun, urls: explicitUrls } = parseArgs(process.argv.slice(2), origin);
  const key = findIndexNowKey();

  const urls = explicitUrls.length ? explicitUrls : await fetchSitemapUrls(origin);

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

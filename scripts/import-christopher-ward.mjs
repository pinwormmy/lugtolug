import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const PRODUCT_SITEMAP = "https://www.christopherward.com/int/sitemap_0-product.xml";
const CACHE_PATH = "/private/tmp/christopher-ward-products.json";
const SEED_PATH = new URL("../data/watches.seed.json", import.meta.url);
const SHOULD_WRITE = process.argv.includes("--write");
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 3;
const execFileAsync = promisify(execFile);

function decodeEntities(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function textContent(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function numericMm(value) {
  const match = String(value ?? "").replaceAll(",", ".").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function compactReference(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "").toUpperCase();
}

function productUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => decodeEntities(match[1]))
    .filter((url) => {
      const filename = decodeURIComponent(new URL(url).pathname.split("/").at(-1));
      return /^C\d/i.test(filename) && filename.endsWith(".html");
    });
}

function productJson(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const value = JSON.parse(match[1]);
      if (value?.["@type"] === "Product" && value.sku) return value;
    } catch {
      // Ignore unrelated malformed structured data.
    }
  }
  return null;
}

function technicalData(html) {
  const values = {};
  const pattern = /<span[^>]+class=["'][^"']*product-technical-label[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<span[^>]+class=["'][^"']*product-technical-value[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
  for (const match of html.matchAll(pattern)) values[textContent(match[1])] = textContent(match[2]);
  return values;
}

function parseProduct(url, html) {
  const product = productJson(html);
  const technical = technicalData(html);
  const lugToLugMm = numericMm(technical["Lug-to-Lug"] ?? technical["Lug to Lug"]);
  const caseMm = numericMm(technical.Size ?? technical.Diameter);
  if (!product?.sku || !product?.name || !lugToLugMm || !caseMm) return null;

  const thicknessMm = numericMm(technical.Height);
  const explicitLugWidthMm = numericMm(technical["Lug Width"] ?? technical["Strap Width"]);
  return {
    url,
    name: textContent(product.name),
    reference: textContent(product.sku),
    lugToLugMm,
    caseMm,
    thicknessMm,
    lugWidthMm: explicitLugWidthMm,
    dialColour: technical["Dial Colour"] || null,
    technicalLabels: Object.keys(technical)
  };
}

async function fetchText(url) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-L",
      "--fail",
      "--silent",
      "--show-error",
      "--retry",
      "3",
      "--retry-delay",
      "1",
      "--max-time",
      "45",
      "--user-agent",
      "lugtolug-finder official data audit (contact: eolthemind@gmail.com)",
      url
    ],
    { maxBuffer: 8 * 1024 * 1024 }
  );
  return stdout;
}

async function mapConcurrent(values, worker) {
  const results = new Array(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next++;
      try {
        results[index] = await worker(values[index], index);
      } catch (error) {
        results[index] = { error: String(error), url: values[index] };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

async function loadProducts() {
  if (!REFRESH) {
    try {
      return JSON.parse(await readFile(CACHE_PATH, "utf8"));
    } catch {
      // Populate the cache below.
    }
  }

  const urls = productUrls(await fetchText(PRODUCT_SITEMAP));
  const crawled = await mapConcurrent(urls, async (url) => parseProduct(url, await fetchText(url)));
  const products = crawled.filter((product) => product && !product.error);
  const failures = crawled.filter((product) => product?.error);
  await writeFile(CACHE_PATH, `${JSON.stringify({ products, failures }, null, 2)}\n`);
  return { products, failures };
}

function officialNote(product) {
  const metrics = [
    `${product.caseMm}mm case diameter`,
    `${product.lugToLugMm}mm lug-to-lug`,
    product.thicknessMm == null ? null : `${product.thicknessMm}mm height`,
    product.lugWidthMm == null ? null : `${product.lugWidthMm}mm lug width`
  ].filter(Boolean);
  return `Official Christopher Ward product page lists ${metrics.join(", ")} for ${product.name} ${product.reference}.`;
}

const { products, failures } = await loadProducts();
if (SHOULD_WRITE && failures.length) {
  throw new Error(`Refusing to write a partial import with ${failures.length} failed product request(s).`);
}
const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map(
  seed.filter((watch) => watch.brand === "Christopher Ward").map((watch) => [compactReference(watch.reference), watch])
);
const maxId = Math.max(...seed.map((watch) => watch.id));
let nextId = maxId + 1;
let added = 0;
let updated = 0;
let unchanged = 0;
const conflicts = [];

for (const product of products) {
  const key = compactReference(product.reference);
  const existing = existingByReference.get(key);
  if (!existing) {
    const watch = {
      id: nextId++,
      brand: "Christopher Ward",
      model: product.name,
      reference: product.reference,
      lugToLugMm: product.lugToLugMm,
      caseMm: product.caseMm,
      thicknessMm: product.thicknessMm,
      lugWidthMm: product.lugWidthMm,
      sources: [{ sourceUrl: product.url, note: officialNote(product) }]
    };
    seed.push(watch);
    existingByReference.set(key, watch);
    added += 1;
    continue;
  }

  if (Number(existing.lugToLugMm) !== product.lugToLugMm || Number(existing.caseMm) !== product.caseMm) {
    conflicts.push({
      reference: product.reference,
      existing: { lugToLugMm: existing.lugToLugMm, caseMm: existing.caseMm },
      official: { lugToLugMm: product.lugToLugMm, caseMm: product.caseMm },
      url: product.url
    });
    continue;
  }

  let changed = false;
  if (existing.thicknessMm == null && product.thicknessMm != null) {
    existing.thicknessMm = product.thicknessMm;
    changed = true;
  }
  if (existing.lugWidthMm == null && product.lugWidthMm != null) {
    existing.lugWidthMm = product.lugWidthMm;
    changed = true;
  }
  if (!existing.sources.some((source) => source.sourceUrl === product.url)) {
    existing.sources.unshift({ sourceUrl: product.url, note: officialNote(product) });
    changed = true;
  }
  if (changed) updated += 1;
  else unchanged += 1;
}

if (SHOULD_WRITE && conflicts.length) {
  throw new Error(`Refusing to write an import with ${conflicts.length} official-source conflict(s).`);
}
if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

const labels = [...new Set(products.flatMap((product) => product.technicalLabels))].sort();
console.log(JSON.stringify({ crawled: products.length, failures, added, updated, unchanged, conflicts, labels, wrote: SHOULD_WRITE }, null, 2));

import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const PRODUCT_SITEMAP = "https://norqain.com/sitemap_products_1.xml?from=8565177319743&to=15634834293113";
const CACHE_PATH = "/private/tmp/norqain-products.json";
const SEED_PATH = new URL("../data/watches.seed.json", import.meta.url);
const SHOULD_WRITE = process.argv.includes("--write");
const REFRESH = process.argv.includes("--refresh");
const CONCURRENCY = 1;
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
    .filter((url) => /\/products\/(?:adventure|independence|freedom|wild-one)/i.test(new URL(url).pathname));
}

function specification(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`${escaped}\\s*:\\s*(\\d+(?:[.,]\\d+)?)\\s*mm`, "i"));
  return numericMm(match?.[1]);
}

function baseReference(sku) {
  const match = String(sku).toUpperCase().match(/^(N[A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+\.[A-Z0-9]+)/);
  return match?.[1] ?? null;
}

function modelName(product) {
  const size = product.tags.find((tag) => /^Size--/i.test(tag))?.split("--")[1];
  const title = textContent(product.title);
  return size && !title.toUpperCase().includes(size.toUpperCase()) ? `${title} ${size.toLowerCase()}` : title;
}

function parseProduct(url, product, html) {
  if (product.type !== "Watch") return null;
  const references = [...new Set(product.variants.map((variant) => baseReference(variant.sku)).filter(Boolean))];
  const lugToLugMm = specification(html, "Lug to lug");
  const caseMm = specification(html, "Diameter");
  if (!references.length || !lugToLugMm || !caseMm) return null;
  return {
    url,
    name: modelName(product),
    references,
    lugToLugMm,
    caseMm,
    thicknessMm: specification(html, "Thickness"),
    lugWidthMm: specification(html, "Width between lugs")
  };
}

async function fetchText(url) {
  const { stdout } = await execFileAsync("curl", [
    "-L", "--fail", "--silent", "--show-error", "--retry", "5", "--retry-all-errors", "--retry-delay", "3",
    "--max-time", "45", "--user-agent", "lugtolug-finder official data audit (contact: eolthemind@gmail.com)", url
  ], { maxBuffer: 12 * 1024 * 1024 });
  return stdout;
}

async function mapConcurrent(values, worker) {
  const results = new Array(values.length);
  let next = 0;
  async function run() {
    while (next < values.length) {
      const index = next++;
      try {
        results[index] = await worker(values[index]);
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
  const crawled = await mapConcurrent(urls, async (url) => {
    const product = JSON.parse(await fetchText(`${url}.js`));
    if (product.type !== "Watch") return null;
    return parseProduct(url, product, await fetchText(url));
  });
  const products = crawled.filter((product) => product && !product.error);
  const failures = crawled.filter((product) => product?.error);
  await writeFile(CACHE_PATH, `${JSON.stringify({ products, failures }, null, 2)}\n`);
  return { products, failures };
}

function officialNote(product, reference) {
  const metrics = [
    `${product.caseMm}mm case diameter`, `${product.lugToLugMm}mm lug-to-lug`,
    product.thicknessMm == null ? null : `${product.thicknessMm}mm thickness`,
    product.lugWidthMm == null ? null : `${product.lugWidthMm}mm width between lugs`
  ].filter(Boolean);
  return `Official NORQAIN product page lists ${metrics.join(", ")} for ${product.name} ${reference}.`;
}

const { products, failures } = await loadProducts();
if (SHOULD_WRITE && failures.length) throw new Error(`Refusing partial import with ${failures.length} failed request(s).`);
const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map(seed.filter((watch) => watch.brand.toLowerCase() === "norqain").map((watch) => [compactReference(watch.reference), watch]));
let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
let added = 0;
let updated = 0;
let unchanged = 0;
const conflicts = [];

for (const product of products) {
  for (const reference of product.references) {
    const key = compactReference(reference);
    const existing = existingByReference.get(key);
    if (!existing) {
      const watch = {
        id: nextId++, brand: "Norqain", model: product.name, reference,
        lugToLugMm: product.lugToLugMm, caseMm: product.caseMm,
        thicknessMm: product.thicknessMm, lugWidthMm: product.lugWidthMm,
        sources: [{ sourceUrl: product.url, note: officialNote(product, reference) }]
      };
      seed.push(watch);
      existingByReference.set(key, watch);
      added += 1;
      continue;
    }
    if (Number(existing.lugToLugMm) !== product.lugToLugMm || Number(existing.caseMm) !== product.caseMm) {
      conflicts.push({ reference, existing: { lugToLugMm: existing.lugToLugMm, caseMm: existing.caseMm }, official: { lugToLugMm: product.lugToLugMm, caseMm: product.caseMm }, url: product.url, resolution: "official source applied" });
      existing.model = product.name;
      existing.lugToLugMm = product.lugToLugMm;
      existing.caseMm = product.caseMm;
      existing.thicknessMm = product.thicknessMm;
      existing.lugWidthMm = product.lugWidthMm;
      if (!existing.sources.some((source) => source.sourceUrl === product.url)) {
        existing.sources.unshift({ sourceUrl: product.url, note: officialNote(product, reference) });
      }
      updated += 1;
      continue;
    }
    let changed = false;
    for (const field of ["thicknessMm", "lugWidthMm"]) {
      if (existing[field] == null && product[field] != null) { existing[field] = product[field]; changed = true; }
    }
    if (!existing.sources.some((source) => source.sourceUrl === product.url)) {
      existing.sources.unshift({ sourceUrl: product.url, note: officialNote(product, reference) });
      changed = true;
    }
    if (changed) updated += 1;
    else unchanged += 1;
  }
}

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);
console.log(JSON.stringify({ crawledPages: products.length, importedReferences: products.reduce((sum, product) => sum + product.references.length, 0), failures, added, updated, unchanged, conflicts, wrote: SHOULD_WRITE }, null, 2));

import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const PRODUCT_SITEMAP = "https://av86.com/sitemap_products_1.xml?from=330788044823&to=11370264396117";
const CACHE_PATH = "/private/tmp/av86-products.json";
const SEED_PATH = new URL("../data/watches.seed.json", import.meta.url);
const SHOULD_WRITE = process.argv.includes("--write");
const WRITE_VERIFIED = process.argv.includes("--write-verified");
const REFRESH = process.argv.includes("--refresh");
const RESUME = process.argv.includes("--resume");
const CONCURRENCY = 1;
const REQUEST_DELAY_MS = 1500;
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

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function productUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => decodeEntities(match[1]))
    .filter((url) => new URL(url).pathname.startsWith("/products/"));
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

function metricValue(html, label) {
  const normalizedLabel = label.replace(/\s+/g, "\\s*");
  const pattern = new RegExp(`${normalizedLabel}[\\s\\S]{0,180}?(\\d+(?:[.,]\\d+)?)\\s*mm`, "i");
  return numericMm(html.match(pattern)?.[1]);
}

function parseProduct(url, html) {
  const product = productJson(html);
  const lugToLugMm = metricValue(html, "Lug to lug");
  const caseMm = metricValue(html, "Case diameter");
  if (!product?.sku || !product?.name || !lugToLugMm || !caseMm) return null;

  const name = textContent(product.name);
  const [canonicalPart, ...variantParts] = name.split(",");
  const canonicalModel = canonicalPart.trim();
  const variant = variantParts.join(",").trim();
  return {
    url,
    name,
    canonicalModel,
    modelGroup: `av86-${slugify(canonicalModel)}`,
    variant: variant || null,
    reference: textContent(product.sku),
    lugToLugMm,
    caseMm,
    thicknessMm: metricValue(html, "Case thickness"),
    lugWidthMm: metricValue(html, "Lug width")
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
      "8",
      "--retry-delay",
      "0",
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
        results[index] = await worker(values[index]);
      } catch (error) {
        results[index] = { error: String(error), url: values[index] };
      }
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

async function loadProducts() {
  if (!REFRESH && !RESUME) {
    try {
      return JSON.parse(await readFile(CACHE_PATH, "utf8"));
    } catch {
      // Populate the cache below.
    }
  }

  let previous = null;
  if (RESUME) {
    try {
      previous = JSON.parse(await readFile(CACHE_PATH, "utf8"));
    } catch {
      // Fall back to a full crawl below.
    }
  }

  const urls = previous?.failures?.length
    ? previous.failures.map((failure) => failure.url)
    : productUrls(await fetchText(PRODUCT_SITEMAP));
  const crawled = await mapConcurrent(urls, async (url) => ({ url, product: parseProduct(url, await fetchText(url)) }));
  const products = [...(previous?.products ?? []), ...crawled.flatMap((result) => (result?.product ? [result.product] : []))];
  const failures = crawled.filter((result) => result?.error);
  const excluded = [
    ...(previous?.excluded ?? []),
    ...crawled.filter((result) => !result?.error && !result?.product).map((result) => result.url)
  ];
  const result = { products, failures, excluded, sitemapProducts: previous?.sitemapProducts ?? urls.length };
  await writeFile(CACHE_PATH, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function officialNote(product) {
  const metrics = [
    `${product.caseMm}mm case diameter`,
    `${product.lugToLugMm}mm lug-to-lug`,
    product.thicknessMm == null ? null : `${product.thicknessMm}mm case thickness`,
    product.lugWidthMm == null ? null : `${product.lugWidthMm}mm lug width`
  ].filter(Boolean);
  return `Official AV86 product page lists ${metrics.join(", ")} for ${product.name} ${product.reference}.`;
}

const { products, failures, excluded, sitemapProducts } = await loadProducts();
const pageConflicts = products.flatMap((product) => {
  const labelledSize = product.name.match(/(?:^|[\s–-])(\d{2}(?:\.\d+)?)\s*mm\s*$/i)?.[1];
  return labelledSize && Number(labelledSize) !== product.caseMm
    ? [{ name: product.name, reference: product.reference, labelledCaseMm: Number(labelledSize), parsedCaseMm: product.caseMm, url: product.url }]
    : [];
});
const pageConflictUrls = new Set(pageConflicts.map((conflict) => conflict.url));
const verifiedProducts = products.filter((product) => !pageConflictUrls.has(product.url));
const duplicateReferences = Object.values(Object.groupBy(verifiedProducts, (product) => compactReference(product.reference)))
  .filter((group) => group.length > 1)
  .map((group) => ({ reference: group[0].reference, urls: group.map((product) => product.url) }));

if (SHOULD_WRITE && failures.length) {
  throw new Error(`Refusing to write a partial import with ${failures.length} failed product request(s).`);
}
if ((SHOULD_WRITE || WRITE_VERIFIED) && pageConflicts.length) {
  console.warn(`Excluding ${pageConflicts.length} product page(s) with conflicting labelled and parsed case sizes.`);
}
if ((SHOULD_WRITE || WRITE_VERIFIED) && duplicateReferences.length) {
  throw new Error(`Refusing to write an import with ${duplicateReferences.length} duplicate product reference(s).`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map(
  seed.filter((watch) => watch.brand === "AV86").map((watch) => [compactReference(watch.reference), watch])
);
let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
let added = 0;
let updated = 0;
let unchanged = 0;
const conflicts = [];

for (const product of verifiedProducts) {
  const key = compactReference(product.reference);
  const existing = existingByReference.get(key);
  if (!existing) {
    const watch = {
      id: nextId++,
      brand: "AV86",
      model: product.name,
      canonicalModel: product.canonicalModel,
      modelGroup: product.modelGroup,
      ...(product.variant ? { variant: product.variant } : {}),
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
  for (const key of ["thicknessMm", "lugWidthMm"]) {
    if (existing[key] == null && product[key] != null) {
      existing[key] = product[key];
      changed = true;
    }
  }
  if (!existing.sources.some((source) => source.sourceUrl === product.url)) {
    existing.sources.unshift({ sourceUrl: product.url, note: officialNote(product) });
    changed = true;
  }
  if (changed) updated += 1;
  else unchanged += 1;
}

if ((SHOULD_WRITE || WRITE_VERIFIED) && conflicts.length) {
  throw new Error(`Refusing to write an import with ${conflicts.length} official-source conflict(s).`);
}
if (SHOULD_WRITE || WRITE_VERIFIED) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      sitemapProducts,
      watchesWithDimensions: products.length,
      verifiedWatches: verifiedProducts.length,
      excludedProducts: excluded.length,
      failedRequests: failures.length,
      failureUrls: failures.map((failure) => failure.url),
      pageConflicts,
      duplicateReferences,
      added,
      updated,
      unchanged,
      conflicts,
      wrote: SHOULD_WRITE || WRITE_VERIFIED,
      verifiedPartial: WRITE_VERIFIED
    },
    null,
    2
  )
);

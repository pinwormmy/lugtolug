import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const COLLECTION_URL = "https://doxawatches.com/collections/all-doxa-watches/products.json?limit=250";
const CACHE_PATH = "/private/tmp/doxa-watch-products.json";
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
    .replaceAll("&times;", "×")
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

function comparableName(value) {
  return String(value)
    .replaceAll("β", " beta ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function modelName(product) {
  const type = textContent(product.product_type);
  const title = textContent(product.title);
  const normalizedType = comparableName(type);
  const normalizedTitle = comparableName(title);
  if (!type) return title;
  if (!title) return type;
  if (normalizedTitle.includes(normalizedType)) return title;
  if (normalizedType.includes(normalizedTitle)) return type;
  return `${type} ${title}`;
}

function uniqueMetrics(matches) {
  const unique = new Map();
  for (const match of matches) {
    const metric = match.slice(1).map(numericMm);
    unique.set(metric.join("|"), metric);
  }
  return [...unique.values()];
}

function parseTechnicalMetrics(html) {
  const pageText = textContent(html);
  const pairs = uniqueMetrics([
    ...pageText.matchAll(
      /\b(?:diameter|case dimensions?)\s*:?[\s-]*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*(?:x|×|by)\s*(\d+(?:[.,]\d+)?)\s*mm\b/gi
    )
  ]);
  const heights = uniqueMetrics([...pageText.matchAll(/\bheight\s*:?[\s-]*(\d+(?:[.,]\d+)?)\s*mm\b/gi)]);
  const lugWidths = uniqueMetrics([...pageText.matchAll(/\blug\s*width\s*:?[\s-]*(\d+(?:[.,]\d+)?)\s*mm\b/gi)]);

  if (pairs.length > 1 || heights.length > 1 || lugWidths.length > 1) {
    throw new Error(
      `Conflicting technical metrics: ${JSON.stringify({ pairs, heights, lugWidths })}`
    );
  }

  return {
    caseMm: pairs[0]?.[0] ?? null,
    lugToLugMm: pairs[0]?.[1] ?? null,
    thicknessMm: heights[0]?.[0] ?? null,
    lugWidthMm: lugWidths[0]?.[0] ?? null
  };
}

function parseProduct(product, html) {
  const metrics = parseTechnicalMetrics(html);
  const variants = product.variants
    .map((variant) => ({
      reference: textContent(variant.sku),
      variantTitle: textContent(variant.title)
    }))
    .filter((variant) => variant.reference);

  return {
    url: `https://doxawatches.com/products/${product.handle}`,
    handle: product.handle,
    model: modelName(product),
    productType: textContent(product.product_type),
    productTitle: textContent(product.title),
    variants,
    ...metrics
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
      "4",
      "--retry-all-errors",
      "--retry-delay",
      "2",
      "--max-time",
      "45",
      "--user-agent",
      "lugtolug-finder official data audit (contact: eolthemind@gmail.com)",
      url
    ],
    { maxBuffer: 12 * 1024 * 1024 }
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
        results[index] = { error: String(error), handle: values[index]?.handle ?? null };
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

  const catalog = JSON.parse(await fetchText(COLLECTION_URL));
  const catalogProducts = catalog.products ?? [];
  const crawled = await mapConcurrent(catalogProducts, async (product) =>
    parseProduct(product, await fetchText(`https://doxawatches.com/products/${product.handle}`))
  );
  const products = crawled.filter((product) => product && !product.error);
  const failures = crawled.filter((product) => product?.error);
  const result = { catalogProductCount: catalogProducts.length, products, failures };
  await writeFile(CACHE_PATH, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function officialNote(product, reference) {
  const metrics = [
    `${product.caseMm}mm case diameter`,
    `${product.lugToLugMm}mm case length/lug-to-lug`,
    product.thicknessMm == null ? null : `${product.thicknessMm}mm height`,
    product.lugWidthMm == null ? null : `${product.lugWidthMm}mm lug width`
  ].filter(Boolean);
  return `Official DOXA product page lists SKU ${reference} and ${metrics.join(", ")}; the second diameter value is stored as lug-to-lug.`;
}

const { catalogProductCount, products, failures } = await loadProducts();
const missingDimensions = products
  .filter((product) => product.caseMm == null || product.lugToLugMm == null)
  .map((product) => ({ handle: product.handle, model: product.model, url: product.url }));
const invalidProducts = products.filter(
  (product) =>
    product.caseMm != null &&
    product.lugToLugMm != null &&
    (product.caseMm <= 0 || product.lugToLugMm <= 0 || product.lugToLugMm < product.caseMm)
);
const importableProducts = products.filter(
  (product) => product.caseMm != null && product.lugToLugMm != null
);

if (SHOULD_WRITE && failures.length) {
  throw new Error(`Refusing to write a partial import with ${failures.length} failed product request(s).`);
}
if (SHOULD_WRITE && invalidProducts.length) {
  throw new Error(`Refusing to write ${invalidProducts.length} product(s) with invalid official dimensions.`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map(
  seed
    .filter((watch) => watch.brand.toLowerCase() === "doxa")
    .map((watch) => [compactReference(watch.reference), watch])
);
let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
let added = 0;
let updated = 0;
let unchanged = 0;
const conflicts = [];

for (const product of importableProducts) {
  for (const variant of product.variants) {
    const key = compactReference(variant.reference);
    const existing = existingByReference.get(key);
    const source = { sourceUrl: product.url, note: officialNote(product, variant.reference) };

    if (!existing) {
      const watch = {
        id: nextId++,
        brand: "Doxa",
        model: product.model,
        reference: variant.reference,
        lugToLugMm: product.lugToLugMm,
        caseMm: product.caseMm,
        thicknessMm: product.thicknessMm,
        lugWidthMm: product.lugWidthMm,
        sources: [source]
      };
      seed.push(watch);
      existingByReference.set(key, watch);
      added += 1;
      continue;
    }

    const officialMetrics = {
      lugToLugMm: product.lugToLugMm,
      caseMm: product.caseMm,
      thicknessMm: product.thicknessMm,
      lugWidthMm: product.lugWidthMm
    };
    const existingMetrics = {
      lugToLugMm: existing.lugToLugMm ?? null,
      caseMm: existing.caseMm ?? null,
      thicknessMm: existing.thicknessMm ?? null,
      lugWidthMm: existing.lugWidthMm ?? null
    };
    if (Object.keys(officialMetrics).some((field) => Number(existingMetrics[field]) !== Number(officialMetrics[field]))) {
      conflicts.push({
        reference: variant.reference,
        existing: existingMetrics,
        official: officialMetrics,
        url: product.url,
        resolution: "official source applied"
      });
    }

    let changed = false;
    if (existing.brand !== "Doxa") {
      existing.brand = "Doxa";
      changed = true;
    }
    if (existing.model !== product.model) {
      existing.model = product.model;
      changed = true;
    }
    for (const [field, value] of Object.entries(officialMetrics)) {
      if (existing[field] !== value) {
        existing[field] = value;
        changed = true;
      }
    }
    const existingSource = existing.sources.find((candidate) => candidate.sourceUrl === product.url);
    if (existingSource) {
      if (existingSource.note !== source.note) {
        existingSource.note = source.note;
        changed = true;
      }
    } else {
      existing.sources.unshift(source);
      changed = true;
    }
    if (changed) updated += 1;
    else unchanged += 1;
  }
}

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      catalogProductCount,
      crawledPages: products.length,
      failedPages: failures.length,
      pagesWithLugToLug: importableProducts.length,
      pagesWithoutLugToLug: missingDimensions.length,
      importedReferences: importableProducts.reduce((sum, product) => sum + product.variants.length, 0),
      failures,
      missingDimensions,
      invalidProducts: invalidProducts.map((product) => ({
        handle: product.handle,
        caseMm: product.caseMm,
        lugToLugMm: product.lugToLugMm
      })),
      added,
      updated,
      unchanged,
      conflicts,
      wrote: SHOULD_WRITE
    },
    null,
    2
  )
);

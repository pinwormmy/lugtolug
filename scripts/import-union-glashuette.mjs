import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const CATALOG_URL = "https://www.union-glashuette.com/en_int/watches.html";
const OFFICIAL_PRODUCT_URL_PATTERN =
  /^https:\/\/www\.union-glashuette\.com\/en_int\/d\d+\.html$/u;
const CACHE_PATH = "/private/tmp/union-glashuette-products.json";
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
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—")
    .replaceAll("&uuml;", "ü")
    .replaceAll("&Uuml;", "Ü")
    .replaceAll("&ouml;", "ö")
    .replaceAll("&Ouml;", "Ö")
    .replaceAll("&auml;", "ä")
    .replaceAll("&Auml;", "Ä")
    .replaceAll("&szlig;", "ß")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textContent(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/gu, " ")).replace(/\s+/gu, " ").trim();
}

function numericMm(value) {
  const match = String(value ?? "").replaceAll(",", ".").match(/\d+(?:\.\d+)?/u);
  return match ? Number(match[0]) : null;
}

function compactReference(value) {
  return String(value).replace(/[^a-z0-9]+/giu, "").toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function uniqueTextMatches(html, pattern) {
  return [...new Set([...html.matchAll(pattern)].map((match) => textContent(match[1])).filter(Boolean))];
}

function requiredSingleText(html, pattern, label) {
  const values = uniqueTextMatches(html, pattern);
  if (values.length !== 1) {
    throw new Error(`Expected one ${label}, found ${values.length}: ${JSON.stringify(values)}`);
  }
  return values[0];
}

function specification(html, label) {
  const escapedLabel = escapeRegExp(label);
  const values = uniqueTextMatches(
    html,
    new RegExp(`<h4\\b[^>]*>\\s*${escapedLabel}\\s*<\\/h4>\\s*<p\\b[^>]*>([\\s\\S]*?)<\\/p>`, "giu")
  );
  if (values.length > 1) {
    throw new Error(`Conflicting ${label} values: ${JSON.stringify(values)}`);
  }
  return values[0] ?? null;
}

function catalogProductCount(html) {
  const value = html.match(
    /<h2\b[^>]*class=["'][^"']*number-results[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>(\d+)<\/span>\s*products found/iu
  )?.[1];
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Could not determine the official catalog product count.");
  }
  return count;
}

function productUrls(html) {
  return [
    ...new Set(
      [...html.matchAll(/href=["'](https:\/\/www\.union-glashuette\.com\/en_int\/d\d+\.html)["']/giu)]
        .map((match) => decodeEntities(match[1]))
        .filter((url) => OFFICIAL_PRODUCT_URL_PATTERN.test(url))
    )
  ];
}

function parseProduct(url, html) {
  const name = requiredSingleText(
    html,
    /<h1\b[^>]*class=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/giu,
    "product name"
  );
  const reference = decodeEntities(
    requiredSingleText(html, /<meta\b[^>]*itemprop=["']sku["'][^>]*content=["']([^"']+)["'][^>]*>/giu, "SKU")
  );
  const urlReference = new URL(url).pathname.split("/").at(-1)?.replace(/\.html$/iu, "") ?? "";
  if (compactReference(reference) !== compactReference(urlReference)) {
    throw new Error(`Product URL/SKU mismatch: ${urlReference} / ${reference}`);
  }

  return {
    url,
    name,
    reference,
    lugToLugMm: numericMm(specification(html, "Lug to lug")),
    caseMm: numericMm(specification(html, "Diameter")),
    thicknessMm: numericMm(specification(html, "Thickness (mm)")),
    lugWidthMm: numericMm(specification(html, "Lugs width (mm)"))
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

  const firstPage = await fetchText(CATALOG_URL);
  const declaredProductCount = catalogProductCount(firstPage);
  const urls = new Set(productUrls(firstPage));
  let page = 2;
  while (urls.size < declaredProductCount) {
    const pageUrls = productUrls(await fetchText(`${CATALOG_URL}?p=${page}`));
    const previousSize = urls.size;
    for (const url of pageUrls) urls.add(url);
    if (urls.size === previousSize) break;
    page += 1;
  }

  const crawled = await mapConcurrent([...urls], async (url) => parseProduct(url, await fetchText(url)));
  const products = crawled.filter((product) => product && !product.error);
  const failures = crawled.filter((product) => product?.error);
  const result = { declaredProductCount, discoveredProductCount: urls.size, products, failures };
  await writeFile(CACHE_PATH, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function officialNote(product) {
  const metrics = [
    `${product.caseMm}mm case diameter`,
    `${product.lugToLugMm}mm lug-to-lug`,
    product.thicknessMm == null ? null : `${product.thicknessMm}mm thickness`,
    product.lugWidthMm == null ? null : `${product.lugWidthMm}mm lug width`
  ].filter(Boolean);
  return `Official Union Glashütte product page lists reference ${product.reference} and ${metrics.join(", ")}.`;
}

const { declaredProductCount, discoveredProductCount, products, failures } = await loadProducts();
const incompleteProducts = products.filter(
  (product) => product.lugToLugMm == null || product.caseMm == null
);
const missingOptionalMetrics = products.filter(
  (product) => product.thicknessMm == null || product.lugWidthMm == null
);
const invalidProducts = products.filter(
  (product) =>
    product.lugToLugMm != null &&
    product.caseMm != null &&
    (product.lugToLugMm <= 0 ||
      product.caseMm <= 0 ||
      (product.thicknessMm != null && product.thicknessMm <= 0) ||
      (product.lugWidthMm != null && product.lugWidthMm <= 0) ||
      product.lugToLugMm < product.caseMm)
);
const duplicateReferences = [...products.reduce((counts, product) => {
  const key = compactReference(product.reference);
  counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}, new Map()).entries()].filter(([, count]) => count > 1);

if (SHOULD_WRITE && declaredProductCount !== discoveredProductCount) {
  throw new Error(
    `Refusing to write incomplete catalog discovery: expected ${declaredProductCount}, found ${discoveredProductCount}.`
  );
}
if (SHOULD_WRITE && failures.length) {
  throw new Error(`Refusing to write a partial import with ${failures.length} failed product request(s).`);
}
if (SHOULD_WRITE && incompleteProducts.length) {
  throw new Error(`Refusing to write ${incompleteProducts.length} product(s) with missing official dimensions.`);
}
if (SHOULD_WRITE && invalidProducts.length) {
  throw new Error(`Refusing to write ${invalidProducts.length} product(s) with invalid official dimensions.`);
}
if (SHOULD_WRITE && duplicateReferences.length) {
  throw new Error(`Refusing to write duplicate official references: ${JSON.stringify(duplicateReferences)}.`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map(
  seed
    .filter((watch) => watch.brand.toLowerCase() === "union glashütte")
    .map((watch) => [compactReference(watch.reference), watch])
);
let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
let added = 0;
let updated = 0;
let unchanged = 0;
const conflicts = [];

for (const product of products) {
  if (incompleteProducts.includes(product)) continue;
  const key = compactReference(product.reference);
  const existing = existingByReference.get(key);
  const source = { sourceUrl: product.url, note: officialNote(product) };
  const officialMetrics = {
    lugToLugMm: product.lugToLugMm,
    caseMm: product.caseMm,
    thicknessMm: product.thicknessMm,
    lugWidthMm: product.lugWidthMm
  };

  if (!existing) {
    const watch = {
      id: nextId++,
      brand: "Union Glashütte",
      model: product.name,
      reference: product.reference,
      ...officialMetrics,
      sources: [source]
    };
    seed.push(watch);
    existingByReference.set(key, watch);
    added += 1;
    continue;
  }

  const existingMetrics = Object.fromEntries(
    Object.keys(officialMetrics).map((field) => [field, existing[field] ?? null])
  );
  if (Object.keys(officialMetrics).some((field) => Number(existingMetrics[field]) !== Number(officialMetrics[field]))) {
    conflicts.push({
      reference: product.reference,
      existing: existingMetrics,
      official: officialMetrics,
      url: product.url,
      resolution: "official source applied"
    });
  }

  let changed = false;
  if (existing.model !== product.name) {
    existing.model = product.name;
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

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      declaredProductCount,
      discoveredProductCount,
      crawledPages: products.length,
      failedPages: failures.length,
      completeProducts: products.length - incompleteProducts.length,
      failures,
      incompleteProducts: incompleteProducts.map((product) => ({
        reference: product.reference,
        url: product.url,
        lugToLugMm: product.lugToLugMm,
        caseMm: product.caseMm,
        thicknessMm: product.thicknessMm,
        lugWidthMm: product.lugWidthMm
      })),
      missingOptionalMetrics: missingOptionalMetrics.map((product) => ({
        reference: product.reference,
        url: product.url,
        thicknessMm: product.thicknessMm,
        lugWidthMm: product.lugWidthMm
      })),
      invalidProducts: invalidProducts.map((product) => ({
        reference: product.reference,
        url: product.url,
        lugToLugMm: product.lugToLugMm,
        caseMm: product.caseMm,
        thicknessMm: product.thicknessMm,
        lugWidthMm: product.lugWidthMm
      })),
      duplicateReferences,
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

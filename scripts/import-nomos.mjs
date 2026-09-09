import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

// Official NOMOS Glashütte international (English) store catalog.
const CATALOG_URL = "https://nomos-glashuette.com/en/store/watches";
const OFFICIAL_PRODUCT_URL_PATTERN = /^https:\/\/nomos-glashuette\.com\/en\/[a-z0-9-]+\/[a-z0-9.-]+$/u;
const CACHE_DIR = process.env.NOMOS_CACHE_DIR ?? "/private/tmp/nomos-official-catalog";
const SEED_PATH = new URL("../data/watches.seed.json", import.meta.url);
const BRAND = "NOMOS";
const SHOULD_WRITE = process.argv.includes("--write") || process.argv.includes("--apply");
const REFRESH = process.argv.includes("--refresh");
// One request at a time with a pause in between; every page is cached on disk.
const REQUEST_DELAY_MS = 750;
const USER_AGENT = "lugtolug-finder official data audit (contact: eolthemind@gmail.com)";
const METRIC_FIELDS = ["caseMm", "thicknessMm", "lugToLugMm", "lugWidthMm"];
const KNOWN_DIMENSION_LABELS = new Set(["diameter", "size", "height", "lug-to-lug"]);
const execFileAsync = promisify(execFile);

function decodeEntities(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&times;", "×")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—")
    .replaceAll("&uuml;", "ü")
    .replaceAll("&Uuml;", "Ü")
    .replaceAll("&ouml;", "ö")
    .replaceAll("&Ouml;", "Ö")
    .replaceAll("&auml;", "ä")
    .replaceAll("&Auml;", "Ä")
    .replaceAll("&eacute;", "é")
    .replaceAll("&szlig;", "ß")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function textContent(value) {
  return decodeEntities(String(value).replace(/<br\s*\/?>/giu, "\n").replace(/<[^>]+>/gu, " "))
    .replace(/[ \t]+/gu, " ")
    .replace(/\s*\n\s*/gu, "\n")
    .trim();
}

function inlineText(value) {
  return textContent(value).replace(/\s+/gu, " ").trim();
}

function millimetres(value) {
  return [...String(value).replaceAll(",", ".").matchAll(/(\d+(?:\.\d+)?)\s*mm/gu)].map((match) => Number(match[1]));
}

function compactReference(value) {
  return String(value).replace(/[^a-z0-9]+/giu, "").toUpperCase();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function uniqueValues(values) {
  return [...new Set(values.map((value) => JSON.stringify(value)))].map((value) => JSON.parse(value));
}

function requiredSingle(values, label) {
  const unique = uniqueValues(values);
  if (unique.length !== 1) {
    throw new Error(`Expected one ${label}, found ${unique.length}: ${JSON.stringify(unique)}`);
  }
  return unique[0];
}

function cacheFileName(url) {
  const { pathname } = new URL(url);
  return `${pathname.replace(/^\/+/u, "").replace(/[^a-z0-9.-]+/giu, "__")}.html`;
}

// Returns { status, html }. curl retries transient failures (timeouts, 429,
// 5xx) on its own; a 404 is a definitive answer and is returned as such.
async function fetchPage(url, downloadPath) {
  const { stdout } = await execFileAsync(
    "curl",
    [
      "-L",
      "--silent",
      "--show-error",
      "--retry",
      "4",
      "--retry-delay",
      "2",
      "--max-time",
      "45",
      "--user-agent",
      USER_AGENT,
      "--output",
      downloadPath,
      "--write-out",
      "%{http_code}",
      url
    ],
    { maxBuffer: 1024 * 1024 }
  );
  const status = Number(stdout.trim());
  return { status, html: status === 200 ? await readFile(downloadPath, "utf8") : null };
}

let lastRequestAt = 0;
// Returns the page HTML, or null when the URL does not exist (HTTP 404).
async function loadPage(url) {
  const cachePath = `${CACHE_DIR}/${cacheFileName(url)}`;
  if (!REFRESH) {
    try {
      return await readFile(cachePath, "utf8");
    } catch {
      // Fetch below.
    }
    try {
      await readFile(`${cachePath}.404`, "utf8");
      return null;
    } catch {
      // Fetch below.
    }
  }
  const wait = lastRequestAt + REQUEST_DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const { status, html } = await fetchPage(url, `${cachePath}.download`);
  lastRequestAt = Date.now();
  if (status === 200) {
    await rename(`${cachePath}.download`, cachePath);
    return html;
  }
  if (status === 404) {
    await writeFile(`${cachePath}.404`, `${url}\n`);
    return null;
  }
  throw new Error(`HTTP ${status} for ${url}`);
}

function dataAttributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/\bdata-([a-z-]+)=["']([^"']*)["']/giu)].map((match) => [match[1], decodeEntities(match[2])])
  );
}

// Every catalog tile is one product box carrying the primary SKU and, when the
// watch is also sold with the other case back, the alternate SKU. The visible
// "Ref. A / B" label must agree with those attributes.
function parseCatalog(html) {
  const declaredProductCount = Number(
    html.match(/<span\b[^>]*class=["'][^"']*js-listing-result-count[^"']*["'][^>]*>\s*(\d+)\s*<\/span>\s*results/iu)?.[1]
  );
  if (!Number.isSafeInteger(declaredProductCount) || declaredProductCount <= 0) {
    throw new Error("Could not determine the official catalog product count.");
  }

  const boxes = [...html.matchAll(/<div\b[^>]*class=["'][^"']*js-product-box[^"']*["'][^>]*>/giu)];
  const tiles = boxes.map((box, index) => {
    const segment = html.slice(box.index, boxes[index + 1]?.index ?? html.length);
    const attributes = dataAttributes(box[0]);
    const link = segment.match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*product-box__title[^"']*["'][^>]*>([^<]*)<\/a>/iu
    );
    const refLabel = segment.match(/class=["'][^"']*product-box__ref[^"']*["'][^>]*>([^<]*)</iu);
    if (!link || !refLabel) throw new Error(`Incomplete product tile for SKU ${attributes.sku ?? "?"}.`);

    const url = decodeEntities(link[1]);
    if (!OFFICIAL_PRODUCT_URL_PATTERN.test(url)) throw new Error(`Unexpected product tile URL: ${url}`);
    const references = [attributes.sku, attributes["alt-sku"]].filter(Boolean);
    const labelledReferences = (inlineText(refLabel[1]).match(/^Ref\.\s*(.+)$/u)?.[1] ?? "")
      .split("/")
      .map((reference) => reference.trim())
      .filter(Boolean);
    if (
      references.length === 0 ||
      JSON.stringify([...references].map(compactReference).sort()) !==
        JSON.stringify(labelledReferences.map(compactReference).sort())
    ) {
      throw new Error(
        `Tile SKU attributes ${JSON.stringify(references)} disagree with label ${JSON.stringify(labelledReferences)} on ${url}.`
      );
    }

    return { url, name: inlineText(link[2]), references, variant: attributes.variant ?? null };
  });

  if (uniqueValues(tiles.map((tile) => tile.url)).length !== tiles.length) {
    throw new Error("Duplicate product tiles in the catalog listing.");
  }
  return { declaredProductCount, tiles };
}

function specsSection(html) {
  const start = html.indexOf('class="product-specs__specs"');
  if (start < 0) throw new Error("Missing product specification block.");
  const end = html.indexOf('data-popup-slug="product-safety-', start);
  if (end < 0) throw new Error("Could not bound the product specification block.");
  return html.slice(start, end);
}

function specEntries(specs, label) {
  return [...specs.matchAll(new RegExp(`<dt>\\s*${label}\\s*<\\/dt>\\s*<dd>([\\s\\S]*?)<\\/dd>`, "giu"))].map(
    (match) => match[1]
  );
}

function parseDimensions(specs) {
  const blocks = specEntries(specs, "Dimensions");
  if (blocks.length !== 1) throw new Error(`Expected one Dimensions block, found ${blocks.length}.`);
  const pairs = [
    ...blocks[0].matchAll(/([a-z][a-z -]*?)\s*<span\b[^>]*class=["'][^"']*size-property[^"']*["'][^>]*>([\s\S]*?)<\/span>/giu)
  ].map((match) => ({ label: inlineText(match[1]).toLowerCase(), text: inlineText(match[2]) }));
  for (const label of new Set(pairs.map((pair) => pair.label))) {
    if (!KNOWN_DIMENSION_LABELS.has(label)) throw new Error(`Unknown dimension label: ${label}`);
  }
  const conflicts = [];
  const single = (label) => {
    const unique = uniqueValues(pairs.filter((pair) => pair.label === label).map((pair) => pair.text));
    if (unique.length > 1) conflicts.push({ label, values: unique });
    return unique[0] ?? null;
  };

  const diameterText = single("diameter");
  const sizeText = single("size");
  const heightText = single("height");
  const lugToLugText = single("lug-to-lug");
  if (diameterText != null && sizeText != null) {
    conflicts.push({ label: "diameter/size", values: [diameterText, sizeText] });
  }

  const diameter = diameterText == null ? [] : millimetres(diameterText);
  const size = sizeText == null ? [] : millimetres(sizeText);
  const height = heightText == null ? [] : millimetres(heightText);
  const lugToLug = lugToLugText == null ? [] : millimetres(lugToLugText);
  if (diameterText != null && diameter.length !== 1) conflicts.push({ label: "diameter", values: [diameterText] });
  if (sizeText != null && size.length !== 2) conflicts.push({ label: "size", values: [sizeText] });
  if (heightText != null && height.length !== 1) conflicts.push({ label: "height", values: [heightText] });
  if (lugToLugText != null && lugToLug.length !== 1) conflicts.push({ label: "lug-to-lug", values: [lugToLugText] });

  return {
    caseShape: sizeText != null ? "rectangular" : diameterText != null ? "round" : null,
    caseText: sizeText ?? diameterText,
    heightText,
    lugToLugText,
    // Rectangular cases publish "width × height"; the width is stored as caseMm.
    caseMm: size[0] ?? diameter[0] ?? null,
    caseSecondMm: size[1] ?? null,
    thicknessMm: height[0] ?? null,
    lugToLugMm: lugToLug[0] ?? null,
    conflicts
  };
}

function parseLugWidth(specs, conflicts) {
  const texts = uniqueValues(
    [...textContent(specs).matchAll(/lug width\s*(\d+(?:[.,]\d+)?\s*mm)/giu)].map((match) => match[1].replace(",", "."))
  );
  if (texts.length > 1) conflicts.push({ label: "lug width", values: texts });
  return { lugWidthText: texts[0] ?? null, lugWidthMm: texts[0] == null ? null : millimetres(texts[0])[0] };
}

function parseCaseBack(specs) {
  const blocks = specEntries(specs, "Case");
  if (blocks.length !== 1) return null;
  const line = textContent(blocks[0])
    .split("\n")
    .find((candidate) => /\bback\b/iu.test(candidate));
  return line ? line.replace(/,\s*$/u, "").trim() : null;
}

function parseProduct(url, html) {
  const name = requiredSingle(
    [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) => inlineText(match[1])),
    "product name"
  );
  const reference = requiredSingle(
    [...html.matchAll(/specs-list--ref[^>]*>\s*<dt>\s*Ref\.\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/giu)].map((match) =>
      inlineText(match[1])
    ),
    "reference"
  );
  const articleNumbers = uniqueValues(
    [...html.matchAll(/Article number:\s*([^<\s]+)/giu)].map((match) => inlineText(match[1]))
  );
  if (articleNumbers.length > 0 && (articleNumbers.length !== 1 || articleNumbers[0] !== reference)) {
    throw new Error(`Reference/article number mismatch: ${reference} / ${JSON.stringify(articleNumbers)}`);
  }
  const slug = new URL(url).pathname.split("/").at(-1) ?? "";
  if (!slug.endsWith(`-${reference.toLowerCase()}`)) {
    throw new Error(`Product URL/reference mismatch: ${slug} / ${reference}`);
  }

  // The case-back selector links the sibling reference (steel back / sapphire
  // crystal glass back / gold back) of the same watch.
  const variantUrls = uniqueValues(
    [...html.matchAll(/<select\b[^>]*js-watch-[a-z-]+-select[^>]*>([\s\S]*?)<\/select>/giu)].flatMap((select) =>
      [...select[1].matchAll(/data-url=["']([^"']+)["']/giu)].map((match) => decodeEntities(match[1]))
    )
  );
  for (const variantUrl of variantUrls) {
    if (!OFFICIAL_PRODUCT_URL_PATTERN.test(variantUrl)) throw new Error(`Unexpected variant URL: ${variantUrl}`);
  }

  const specs = specsSection(html);
  const dimensions = parseDimensions(specs);
  const conflicts = [...dimensions.conflicts];
  const lugWidth = parseLugWidth(specs, conflicts);

  return {
    url,
    name,
    reference,
    caseBack: parseCaseBack(specs),
    caseShape: dimensions.caseShape,
    caseText: dimensions.caseText,
    heightText: dimensions.heightText,
    lugToLugText: dimensions.lugToLugText,
    lugWidthText: lugWidth.lugWidthText,
    caseMm: dimensions.caseMm,
    caseSecondMm: dimensions.caseSecondMm,
    thicknessMm: dimensions.thicknessMm,
    lugToLugMm: dimensions.lugToLugMm,
    lugWidthMm: lugWidth.lugWidthMm,
    conflicts,
    variantUrls
  };
}

async function crawl() {
  await mkdir(CACHE_DIR, { recursive: true });
  const catalogHtml = await loadPage(CATALOG_URL);
  if (catalogHtml == null) throw new Error(`Catalog page not found: ${CATALOG_URL}`);
  const catalog = parseCatalog(catalogHtml);
  const queue = catalog.tiles.map((tile) => tile.url);
  const seen = new Set(queue);
  const products = [];
  const failures = [];
  const missingPages = [];

  const visit = async (url) => {
    try {
      const html = await loadPage(url);
      if (html == null) {
        missingPages.push(url);
        return;
      }
      const product = parseProduct(url, html);
      products.push(product);
      // Visit a watch's other case back right after it so sibling references
      // stay adjacent in the seed.
      const siblings = product.variantUrls.filter((variantUrl) => !seen.has(variantUrl));
      for (const variantUrl of siblings) seen.add(variantUrl);
      queue.unshift(...siblings);
    } catch (error) {
      failures.push({ url, error: String(error?.message ?? error) });
    }
    process.stderr.write(`\r${products.length + failures.length + missingPages.length}/${seen.size} pages`);
  };

  while (queue.length > 0) await visit(queue.shift());

  // A listing can declare an alternate SKU whose page is not linked from the
  // primary page. Probe the conventional URL so the report can say whether the
  // page exists (parsed) or not (HTTP 404) instead of guessing.
  const crawledKeys = new Set(products.map((product) => compactReference(product.reference)));
  const unlinkedReferences = [];
  for (const tile of catalog.tiles) {
    const linkedReference = tile.references.find((reference) =>
      new URL(tile.url).pathname.toLowerCase().endsWith(`-${reference.toLowerCase()}`)
    );
    for (const reference of tile.references) {
      if (crawledKeys.has(compactReference(reference)) || !linkedReference) continue;
      const probeUrl = tile.url.replace(
        new RegExp(`-${escapeRegExp(linkedReference.toLowerCase())}$`, "u"),
        `-${reference.toLowerCase()}`
      );
      if (seen.has(probeUrl)) continue;
      seen.add(probeUrl);
      const before = missingPages.length;
      await visit(probeUrl);
      if (missingPages.length > before) {
        unlinkedReferences.push({ reference, tile: tile.url, probedUrl: probeUrl, status: 404 });
      } else {
        crawledKeys.add(compactReference(reference));
      }
    }
  }
  process.stderr.write("\n");

  return { ...catalog, discoveredUrlCount: seen.size, products, failures, missingPages, unlinkedReferences };
}

function officialNote(product) {
  const caseDescription =
    product.caseShape === "rectangular"
      ? `${product.caseText} case size (the first value, the case width, is stored as the case diameter)`
      : `${product.caseText} case diameter`;
  const metrics = [
    caseDescription,
    product.heightText == null ? null : `${product.heightText} height`,
    `${product.lugToLugText} lug-to-lug`,
    product.lugWidthText == null ? null : `${product.lugWidthText} lug width`
  ].filter(Boolean);
  const back = product.caseBack ? ` (${product.caseBack})` : "";
  return `Official NOMOS Glashütte product page lists Ref. ${product.reference}${back} and ${metrics.join(", ")}.`;
}

function metricSummary(product) {
  return Object.fromEntries(METRIC_FIELDS.map((field) => [field, product[field]]));
}

const { declaredProductCount, tiles, discoveredUrlCount, products, failures, missingPages, unlinkedReferences } =
  await crawl();
const declaredReferences = new Set(tiles.flatMap((tile) => tile.references.map(compactReference)));
const crawledReferences = new Map();
for (const product of products) {
  const key = compactReference(product.reference);
  crawledReferences.set(key, [...(crawledReferences.get(key) ?? []), product.url]);
}
const duplicateReferences = [...crawledReferences.entries()].filter(([, urls]) => urls.length > 1);
const unlinkedKeys = new Set(unlinkedReferences.map((entry) => compactReference(entry.reference)));
const missingReferences = [...declaredReferences].filter(
  (reference) => !crawledReferences.has(reference) && !unlinkedKeys.has(reference)
);
const undeclaredReferences = [...crawledReferences.keys()].filter((reference) => !declaredReferences.has(reference));
const unexpectedMissingPages = missingPages.filter(
  (url) => !unlinkedReferences.some((entry) => entry.probedUrl === url)
);

// Case-back siblings share a case, so their pages should publish the same case
// size and lug-to-lug. Each page is still stored as published; the pairs that
// disagree are reported so the discrepancy on the official site is visible.
const productsByUrl = new Map(products.map((product) => [product.url, product]));
const seenSiblingPairs = new Set();
const siblingDisagreements = [];
for (const product of products) {
  for (const variantUrl of product.variantUrls) {
    const sibling = productsByUrl.get(variantUrl);
    if (!sibling || sibling === product) continue;
    const pairKey = [product.reference, sibling.reference].sort().join("/");
    if (seenSiblingPairs.has(pairKey)) continue;
    seenSiblingPairs.add(pairKey);
    if (product.caseMm !== sibling.caseMm || product.lugToLugMm !== sibling.lugToLugMm) {
      siblingDisagreements.push({
        model: product.name,
        pages: [product, sibling].map((entry) => ({
          reference: entry.reference,
          caseBack: entry.caseBack,
          caseMm: entry.caseMm,
          lugToLugMm: entry.lugToLugMm,
          url: entry.url
        }))
      });
    }
  }
}

const conflictingProducts = products.filter((product) => product.conflicts.length > 0);
const incompleteProducts = products.filter(
  (product) => product.conflicts.length === 0 && (product.lugToLugMm == null || product.caseMm == null)
);
const importableProducts = products.filter(
  (product) => product.conflicts.length === 0 && product.lugToLugMm != null && product.caseMm != null
);
const invalidProducts = importableProducts.filter(
  (product) =>
    product.caseMm <= 0 ||
    product.caseMm > 100 ||
    product.lugToLugMm <= 0 ||
    product.lugToLugMm > 100 ||
    product.lugToLugMm < product.caseMm ||
    (product.thicknessMm != null && (product.thicknessMm <= 0 || product.thicknessMm > 50)) ||
    (product.lugWidthMm != null && (product.lugWidthMm <= 0 || product.lugWidthMm > 50))
);
const missingOptionalMetrics = importableProducts.filter(
  (product) => product.thicknessMm == null || product.lugWidthMm == null
);

const refusals = [];
if (tiles.length !== declaredProductCount) {
  refusals.push(`catalog declared ${declaredProductCount} products but ${tiles.length} tiles were found`);
}
if (failures.length) refusals.push(`${failures.length} product page(s) failed to load or parse`);
if (unexpectedMissingPages.length) refusals.push(`${unexpectedMissingPages.length} linked product page(s) returned 404`);
if (missingReferences.length) refusals.push(`${missingReferences.length} declared reference(s) were not resolved`);
if (undeclaredReferences.length) {
  refusals.push(`${undeclaredReferences.length} crawled reference(s) are not in the catalog listing`);
}
if (duplicateReferences.length) refusals.push(`${duplicateReferences.length} reference(s) appear on more than one page`);
if (invalidProducts.length) refusals.push(`${invalidProducts.length} product(s) have invalid official dimensions`);
if (SHOULD_WRITE && refusals.length) {
  throw new Error(`Refusing to write the NOMOS import: ${refusals.join("; ")}.`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map();
for (const watch of seed) {
  if (watch.brand.toLowerCase() !== BRAND.toLowerCase()) continue;
  const key = compactReference(watch.reference);
  if (existingByReference.has(key)) {
    throw new Error(`Seed already holds two ${BRAND} records for reference ${watch.reference}.`);
  }
  existingByReference.set(key, watch);
}

let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
const added = [];
const updated = [];
const unchanged = [];
const corrections = [];
const keptExistingMetrics = [];
const nameDifferences = [];
const officialReferenceKeys = new Set();

for (const product of importableProducts) {
  const key = compactReference(product.reference);
  officialReferenceKeys.add(key);
  const existing = existingByReference.get(key);
  const source = { sourceUrl: product.url, note: officialNote(product) };
  const officialMetrics = metricSummary(product);

  if (!existing) {
    const watch = {
      id: nextId++,
      brand: BRAND,
      model: product.name,
      reference: product.reference,
      lugToLugMm: product.lugToLugMm,
      caseMm: product.caseMm,
      thicknessMm: product.thicknessMm,
      lugWidthMm: product.lugWidthMm,
      sources: [source]
    };
    seed.push(watch);
    existingByReference.set(key, watch);
    added.push({ id: watch.id, reference: product.reference, model: product.name, url: product.url, ...officialMetrics });
    continue;
  }

  // Existing records keep their display name and their other sources; the
  // official dimensions replace the stored ones wherever the page publishes a
  // value, and stored values stay when the page publishes none.
  const existingMetrics = Object.fromEntries(METRIC_FIELDS.map((field) => [field, existing[field] ?? null]));
  const applied = {};
  const kept = {};
  for (const field of METRIC_FIELDS) {
    if (officialMetrics[field] == null) {
      if (existingMetrics[field] != null) kept[field] = existingMetrics[field];
      continue;
    }
    if (existingMetrics[field] !== officialMetrics[field]) applied[field] = officialMetrics[field];
  }
  if (Object.keys(applied).length) {
    corrections.push({
      id: existing.id,
      reference: product.reference,
      model: existing.model,
      existing: existingMetrics,
      official: officialMetrics,
      url: product.url
    });
  }
  if (Object.keys(kept).length) {
    keptExistingMetrics.push({ id: existing.id, reference: product.reference, kept, url: product.url });
  }
  if (existing.model !== product.name) {
    nameDifferences.push({ id: existing.id, reference: product.reference, stored: existing.model, official: product.name });
  }

  let changed = false;
  for (const [field, value] of Object.entries(applied)) {
    existing[field] = value;
    changed = true;
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
  if (changed) updated.push({ id: existing.id, reference: product.reference, model: existing.model });
  else unchanged.push({ id: existing.id, reference: product.reference });
}

const existingWithoutOfficialMatch = seed
  .filter(
    (watch) =>
      watch.brand.toLowerCase() === BRAND.toLowerCase() && !officialReferenceKeys.has(compactReference(watch.reference))
  )
  .map((watch) => ({ id: watch.id, reference: watch.reference, model: watch.model }));

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

const describe = (product) => ({
  reference: product.reference,
  model: product.name,
  url: product.url,
  ...metricSummary(product),
  ...(product.caseSecondMm == null ? {} : { caseSecondMm: product.caseSecondMm }),
  ...(product.conflicts.length ? { conflicts: product.conflicts } : {})
});

console.log(
  JSON.stringify(
    {
      catalogUrl: CATALOG_URL,
      declaredProductCount,
      catalogTiles: tiles.length,
      declaredReferenceCount: declaredReferences.size,
      discoveredUrlCount,
      crawledPages: products.length,
      failedPages: failures.length,
      importableProducts: importableProducts.length,
      rectangularCases: importableProducts.filter((product) => product.caseShape === "rectangular").length,
      siblingPairs: seenSiblingPairs.size,
      siblingDisagreements,
      failures,
      unexpectedMissingPages,
      unlinkedReferences,
      missingReferences,
      undeclaredReferences,
      duplicateReferences,
      conflictingProducts: conflictingProducts.map(describe),
      incompleteProducts: incompleteProducts.map(describe),
      invalidProducts: invalidProducts.map(describe),
      missingOptionalMetrics: missingOptionalMetrics.map(describe),
      added: added.length,
      updated: updated.length,
      unchanged: unchanged.length,
      addedRecords: added,
      updatedRecords: updated,
      corrections,
      keptExistingMetrics,
      nameDifferences,
      existingWithoutOfficialMatch,
      refusals,
      wrote: SHOULD_WRITE
    },
    null,
    2
  )
);

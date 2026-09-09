import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

// Official Grand Seiko catalog. The global English site (grand-seiko.com/global-en)
// publishes "Case size: Diameter … Lug-to-lug … Thickness …" and "Band width"
// on every product page. Its collection listings are rendered client-side
// from the site's own search index, so products are enumerated from that
// index, from the collection pages' server-rendered links and from the US
// sitemap (the same references under the us-en locale); a reference that
// only the US site carries is read from its us-en page.
const ORIGIN = "https://www.grand-seiko.com";
const LOCALES = ["global-en", "us-en"];
const SEARCH_API = "https://finder.api.mf.marsflag.com/api/v1/finder_service/documents/4ec5033d/search";
const SEARCH_CATEGORY = "GlobalEn";
const SEARCH_API_PAGE_SIZE = 100;
const US_SITEMAP_URL = `${ORIGIN}/vendor/sitemap?xml=us-enGrandSeikoSitemap1.xml`;
const CATEGORY_PATHS = ["all", "heritage", "elegance", "evolution9", "sport", "masterpiece"];
const PRODUCT_PATH_PATTERN = /^\/(global-en|us-en)\/collections\/([a-z]{3,4}\d{3}[a-z]?)\/?$/iu;
const BRAND = "Grand Seiko";
const METRIC_FIELDS = ["caseMm", "thicknessMm", "lugToLugMm", "lugWidthMm"];
const CACHE_DIR = process.env.GRAND_SEIKO_CACHE_DIR ?? "/private/tmp/grand-seiko-official-catalog";
const SEED_PATH = new URL("../data/watches.seed.json", import.meta.url);
const SHOULD_WRITE = process.argv.includes("--write") || process.argv.includes("--apply");
const REFRESH = process.argv.includes("--refresh");
const REQUEST_DELAY_MS = 750;
const USER_AGENT = "lugtolug-finder official data audit (contact: eolthemind@gmail.com)";
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
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replaceAll("&lsquo;", "‘")
    .replaceAll("&rsquo;", "’")
    .replaceAll("&hellip;", "…")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function inlineText(value) {
  return decodeEntities(String(value).replace(/<[^>]+>/gu, " ")).replace(/\s+/gu, " ").trim();
}

function compactReference(value) {
  return String(value).replace(/[^a-z0-9]+/giu, "").toUpperCase();
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
  const { host, pathname, search } = new URL(url);
  const query = search ? `__${search.replace(/[^a-z0-9.-]+/giu, "_")}` : "";
  return `${host}__${pathname.replace(/^\/+/u, "").replace(/[^a-z0-9.-]+/giu, "__")}${query}.html`;
}

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
      "60",
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
  return { status, body: status === 200 ? await readFile(downloadPath, "utf8") : null };
}

let lastRequestAt = 0;
// Returns the response body, or null when the URL does not exist (HTTP 404).
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
  const { status, body } = await fetchPage(url, `${cachePath}.download`);
  lastRequestAt = Date.now();
  if (status === 200) {
    await rename(`${cachePath}.download`, cachePath);
    return body;
  }
  if (status === 404) {
    await writeFile(`${cachePath}.404`, `${url}\n`);
    return null;
  }
  throw new Error(`HTTP ${status} for ${url}`);
}

async function requirePage(url) {
  const body = await loadPage(url);
  if (body == null) throw new Error(`Page not found: ${url}`);
  return body;
}

// The global site answers HTTP 200 with a "404 Page Not Found" page for
// references it does not carry.
function isSoftNotFound(html) {
  return /<h1\b[^>]*>\s*404\b/iu.test(html) || /<title>\s*404\b/iu.test(html);
}

function productSlug(url) {
  const match = new URL(url, ORIGIN).pathname.match(PRODUCT_PATH_PATTERN);
  return match ? match[2].toLowerCase() : null;
}

function productLinks(html, locale) {
  return uniqueValues(
    [...html.matchAll(/href=["']((?:https:\/\/www\.grand-seiko\.com)?\/[a-z-]+\/collections\/[a-z]{3,4}\d{3}[a-z]?)\/?["']/giu)]
      .map((match) => decodeEntities(match[1]))
      .filter((href) => new URL(href, ORIGIN).pathname.startsWith(`/${locale}/`))
      .map((href) => productSlug(href))
      .filter(Boolean)
  );
}

// "Diameter 41.0mm Lug-to-lug 49.0mm Thickness 12.5mm" → labelled values.
function caseSizeParts(text) {
  const parts = [];
  for (const match of text.matchAll(/([A-Za-z][A-Za-z -]*?)\s*(\d+(?:\.\d+)?)\s*mm/gu)) {
    parts.push({ label: match[1].trim().toLowerCase(), value: Number(match[2]), text: `${match[1].trim()} ${match[2]}mm` });
  }
  return parts;
}

function parseProduct(url, html) {
  const locale = new URL(url).pathname.split("/")[1];
  const slug = productSlug(url);
  const reference = requiredSingle(
    [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) => inlineText(match[1])),
    "product heading"
  );
  if (!/^[A-Z]{3,4}\d{3}$/u.test(reference) || !slug.startsWith(reference.toLowerCase())) {
    throw new Error(`URL/reference mismatch: ${slug} / ${reference}`);
  }
  const canonical = requiredSingle(
    [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/giu)].map((match) =>
      new URL(decodeEntities(match[1]), ORIGIN).pathname
    ),
    "canonical path"
  );
  if (canonical !== new URL(url).pathname) throw new Error(`Canonical path differs: ${canonical}`);

  // The page header stacks the collection, an optional studio line, the
  // movement family and the reference; regional editions carry a title line
  // instead. The collection label under the product image is always present.
  const headerBlocks = uniqueValues(
    [...html.matchAll(/imagePageHeader-body[\s\S]*?<p\b[^>]*_title[^>]*>([\s\S]*?)<\/p>/giu)].map((match) =>
      match[1]
        .split(/<br\s*\/?>|<\/span>/giu)
        .map((line) => inlineText(line))
        .filter(Boolean)
    )
  );
  if (headerBlocks.length > 1) throw new Error(`Conflicting page headers: ${JSON.stringify(headerBlocks)}`);
  // Some regional product pages have no header block at all.
  const headerLines = headerBlocks[0] ?? [];
  const collection = requiredSingle(
    [...html.matchAll(/<p\b[^>]*class=["'][^"']*\b_collection\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/giu)].map((match) =>
      inlineText(match[1])
    ),
    "collection label"
  );

  // Strap options repeat labels such as "Color"; only the rows used here must
  // agree with themselves.
  const rows = new Map();
  for (const row of html.matchAll(/<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/giu)) {
    const label = inlineText(row[1]).replace(/\s*:$/u, "");
    const text = inlineText(row[2]);
    rows.set(label, [...(rows.get(label) ?? []), text]);
  }
  const conflicts = [];
  const singleRow = (label, field) => {
    const seen = new Map();
    for (const text of rows.get(label) ?? []) seen.set(text.replace(/\s+/gu, "").toLowerCase(), text);
    const values = [...seen.values()];
    if (values.length > 1) conflicts.push({ field, text: values.join(" / ") });
    return values.length === 1 ? values[0] : null;
  };
  const movementType = singleRow("Movement Type", "movementType");

  // The reference usually closes the header; some pages end with a title line.
  const titleLines = headerLines
    .filter((line) => line !== reference)
    .map((line) => line.replace(/^Grand Seiko\s+/iu, ""));
  let model;
  let nameSource;
  if (titleLines.length >= 2 && /\bCollection$/u.test(titleLines[0])) {
    model = `${collection} ${titleLines.at(-1)}`;
    nameSource = "collection-family";
  } else if (titleLines.length >= 1) {
    model = titleLines.join(" ");
    nameSource = "header-title";
  } else {
    model = movementType ? `${collection} ${movementType}` : collection;
    nameSource = movementType ? "collection-movement" : "collection";
  }
  if (model.length > 90) throw new Error(`Model name too long: ${model}`);

  const metrics = { caseMm: null, thicknessMm: null, lugToLugMm: null, lugWidthMm: null };
  const texts = { caseSize: singleRow("Case size", "caseSize"), bandWidth: singleRow("Band width", "lugWidthMm") };
  if (texts.caseSize != null) {
    const parts = caseSizeParts(texts.caseSize);
    const byLabel = new Map();
    for (const part of parts) {
      const field =
        part.label === "diameter" || part.label === "width"
          ? "caseMm"
          : part.label === "lug-to-lug" || part.label === "lug to lug"
            ? "lugToLugMm"
            : part.label === "thickness"
              ? "thicknessMm"
              : null;
      if (!field) throw new Error(`Unknown case size label "${part.label}" in "${texts.caseSize}"`);
      if (byLabel.has(field) && byLabel.get(field) !== part.value) conflicts.push({ field, text: texts.caseSize });
      byLabel.set(field, part.value);
    }
    for (const [field, value] of byLabel) metrics[field] = value;
    metrics.caseShape = parts.some((part) => part.label === "width") ? "rectangular" : "round";
  }
  if (texts.bandWidth != null) {
    const values = [...texts.bandWidth.matchAll(/(\d+(?:\.\d+)?)\s*mm/gu)].map((match) => Number(match[1]));
    if (values.length !== 1) conflicts.push({ field: "lugWidthMm", text: texts.bandWidth });
    else metrics.lugWidthMm = values[0];
  }

  return { url, locale, slug, reference, collection, headerLines, model, nameSource, metrics, texts, conflicts };
}

async function crawl() {
  await mkdir(CACHE_DIR, { recursive: true });
  const candidates = new Map(); // slug → Set(origins)
  const addCandidate = (slug, origin) => {
    if (!slug) return;
    (candidates.get(slug) ?? candidates.set(slug, new Set()).get(slug)).add(origin);
  };

  // 1. The site's own search index, GlobalEn category.
  let searchHits = null;
  let searchPages = 0;
  let searchProductDocs = 0;
  const staleIndexDocs = [];
  for (let page = 1; ; page += 1) {
    const result = JSON.parse(
      await requirePage(
        `${SEARCH_API}?q=*:*&category=${SEARCH_CATEGORY}&number_per_page=${SEARCH_API_PAGE_SIZE}&page_number=${page}`
      )
    );
    searchHits = result.organic.hits;
    searchPages += 1;
    const docs = result.organic.docs ?? [];
    for (const doc of docs) {
      const slug = productSlug(doc.url);
      if (!slug || !new URL(doc.url).pathname.startsWith("/global-en/")) continue;
      // The index keeps entries for withdrawn products; their indexed title is
      // the site's own "404 Page Not Found".
      if (/^404\b/u.test(doc.title ?? "")) {
        staleIndexDocs.push(doc.url);
        continue;
      }
      addCandidate(slug, "search-index");
      searchProductDocs += 1;
    }
    if (docs.length < SEARCH_API_PAGE_SIZE || page * SEARCH_API_PAGE_SIZE >= searchHits) break;
  }

  // 2. Server-rendered links on the collection pages.
  const categoryLinkCounts = {};
  for (const path of CATEGORY_PATHS) {
    const slugs = productLinks(await requirePage(`${ORIGIN}/global-en/collections/${path}`), "global-en");
    categoryLinkCounts[path] = slugs.length;
    for (const slug of slugs) addCandidate(slug, "collection-page");
  }

  // 3. The US sitemap (the global site publishes no sitemap of its own).
  const usSitemap = await requirePage(US_SITEMAP_URL);
  const usSlugs = uniqueValues(
    [...usSitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => productSlug(decodeEntities(match[1]))).filter(Boolean)
  );
  for (const slug of usSlugs) addCandidate(slug, "us-sitemap");

  const products = [];
  const failures = [];
  const usOnly = [];
  const unresolved = [];
  let visited = 0;
  for (const [slug, origins] of [...candidates.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    let product = null;
    let error = null;
    for (const locale of LOCALES) {
      const url = `${ORIGIN}/${locale}/collections/${slug}`;
      try {
        const html = await loadPage(url);
        visited += 1;
        if (html == null || isSoftNotFound(html)) continue;
        product = parseProduct(url, html);
        product.origins = [...origins];
        break;
      } catch (caught) {
        error = { url, error: String(caught?.message ?? caught) };
        break;
      }
    }
    if (error) failures.push(error);
    else if (product) {
      products.push(product);
      if (product.locale !== "global-en") usOnly.push({ slug, url: product.url, origins: [...origins] });
    } else unresolved.push({ slug, origins: [...origins] });
    process.stderr.write(`\r${visited} requests, ${products.length}/${candidates.size} products`);
  }
  process.stderr.write("\n");

  return {
    searchHits,
    searchPages,
    searchProductDocs,
    staleIndexDocs,
    categoryLinkCounts,
    usSitemapProducts: usSlugs.length,
    candidateCount: candidates.size,
    candidateOrigins: Object.fromEntries(
      ["search-index", "collection-page", "us-sitemap"].map((origin) => [
        origin,
        [...candidates.values()].filter((origins) => origins.has(origin)).length
      ])
    ),
    products,
    failures,
    usOnly,
    unresolved
  };
}

function officialNote(product) {
  const { texts, metrics, reference, locale } = product;
  const site = locale === "global-en" ? "global" : "US";
  const caseSize =
    metrics.caseShape === "rectangular"
      ? `case size ${texts.caseSize} (the width is stored as the case diameter)`
      : `case size ${texts.caseSize}`;
  const band = texts.bandWidth == null ? "" : `, band width ${texts.bandWidth} (stored as lug width)`;
  return `Official Grand Seiko ${site} product page lists ${reference} with ${caseSize}${band}.`;
}

const crawlResult = await crawl();
const { products, failures, usOnly, unresolved } = crawlResult;

const byReference = new Map();
for (const product of products) {
  const key = compactReference(product.reference);
  if (byReference.has(key)) throw new Error(`Reference parsed twice: ${product.reference}`);
  byReference.set(key, product);
}

const conflictingProducts = products.filter((product) => product.conflicts.length > 0);
const incompleteProducts = products.filter(
  (product) => product.conflicts.length === 0 && (product.metrics.caseMm == null || product.metrics.lugToLugMm == null)
);
const importableProducts = products.filter(
  (product) => product.conflicts.length === 0 && product.metrics.caseMm != null && product.metrics.lugToLugMm != null
);
const invalidProducts = importableProducts.filter(({ metrics }) =>
  metrics.caseMm <= 0 ||
  metrics.caseMm > 100 ||
  metrics.lugToLugMm <= 0 ||
  metrics.lugToLugMm > 100 ||
  metrics.lugToLugMm < metrics.caseMm ||
  (metrics.thicknessMm != null && (metrics.thicknessMm <= 0 || metrics.thicknessMm > 50)) ||
  (metrics.lugWidthMm != null && (metrics.lugWidthMm <= 0 || metrics.lugWidthMm > 50))
);
const missingOptionalMetrics = importableProducts.filter(
  ({ metrics }) => metrics.thicknessMm == null || metrics.lugWidthMm == null
);

const refusals = [];
if (failures.length) refusals.push(`${failures.length} product page(s) failed to load or parse`);
if (unresolved.length) refusals.push(`${unresolved.length} listed product(s) have no page on either locale`);
if (invalidProducts.length) refusals.push(`${invalidProducts.length} product(s) have invalid official dimensions`);
if (SHOULD_WRITE && refusals.length) {
  throw new Error(`Refusing to write the Grand Seiko import: ${refusals.join("; ")}.`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const existingByReference = new Map();
for (const watch of seed) {
  if (watch.brand !== BRAND) continue;
  const key = compactReference(watch.reference);
  if (existingByReference.has(key)) throw new Error(`Seed already holds two ${BRAND} records for ${watch.reference}.`);
  existingByReference.set(key, watch);
}

let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
const added = [];
const updated = [];
const unchanged = [];
const corrections = [];
const keptExistingMetrics = [];
const nameDifferences = [];
const officialKeys = new Set();

for (const product of importableProducts) {
  const key = compactReference(product.reference);
  officialKeys.add(key);
  const existing = existingByReference.get(key);
  const source = { sourceUrl: product.url, note: officialNote(product) };
  const officialMetrics = Object.fromEntries(METRIC_FIELDS.map((field) => [field, product.metrics[field]]));

  if (!existing) {
    const watch = {
      id: nextId++,
      brand: BRAND,
      model: product.model,
      reference: product.reference,
      lugToLugMm: officialMetrics.lugToLugMm,
      caseMm: officialMetrics.caseMm,
      thicknessMm: officialMetrics.thicknessMm,
      lugWidthMm: officialMetrics.lugWidthMm,
      sources: [source]
    };
    seed.push(watch);
    existingByReference.set(key, watch);
    added.push({
      id: watch.id,
      reference: watch.reference,
      model: watch.model,
      nameSource: product.nameSource,
      locale: product.locale,
      ...officialMetrics
    });
    continue;
  }

  // Existing records keep their display name, grouping metadata and other
  // sources; official values replace stored ones, stored values stay where
  // the page publishes none.
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
  if (Object.keys(kept).length) keptExistingMetrics.push({ id: existing.id, reference: product.reference, kept });
  if (existing.model !== product.model) {
    nameDifferences.push({ id: existing.id, reference: product.reference, stored: existing.model, official: product.model });
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
  if (changed) updated.push({ id: existing.id, reference: product.reference });
  else unchanged.push({ id: existing.id, reference: product.reference });
}

const existingWithoutOfficialMatch = seed
  .filter((watch) => watch.brand === BRAND && !officialKeys.has(compactReference(watch.reference)))
  .map((watch) => ({ id: watch.id, reference: watch.reference, model: watch.model }));

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

const describe = (product) => ({
  reference: product.reference,
  model: product.model,
  url: product.url,
  ...Object.fromEntries(METRIC_FIELDS.map((field) => [field, product.metrics[field]])),
  ...(product.conflicts.length ? { conflicts: product.conflicts } : {}),
  ...(product.texts.caseSize == null ? { caseSize: null } : {})
});

console.log(
  JSON.stringify(
    {
      searchIndex: {
        category: SEARCH_CATEGORY,
        hits: crawlResult.searchHits,
        pages: crawlResult.searchPages,
        productDocs: crawlResult.searchProductDocs,
        staleDocs: crawlResult.staleIndexDocs.length
      },
      collectionPageLinks: crawlResult.categoryLinkCounts,
      usSitemapProducts: crawlResult.usSitemapProducts,
      candidateProducts: crawlResult.candidateCount,
      candidateOrigins: crawlResult.candidateOrigins,
      crawledPages: products.length,
      byLocale: products.reduce((counts, product) => ({ ...counts, [product.locale]: (counts[product.locale] ?? 0) + 1 }), {}),
      failedPages: failures.length,
      importableProducts: importableProducts.length,
      rectangularCases: importableProducts.filter((product) => product.metrics.caseShape === "rectangular").length,
      failures,
      unresolved,
      usOnly,
      conflictingProducts: conflictingProducts.map(describe),
      incompleteProducts: incompleteProducts.map(describe),
      invalidProducts: invalidProducts.map(describe),
      missingOptionalMetrics: missingOptionalMetrics.map(describe),
      collections: importableProducts.reduce(
        (counts, product) => ({ ...counts, [product.collection]: (counts[product.collection] ?? 0) + 1 }),
        {}
      ),
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

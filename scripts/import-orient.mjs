import { execFile } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

// Orient and Orient Star official catalogs. orientwatchusa.com blocks every
// non-browser client at the Cloudflare edge (HTTP 403 "Sorry, you have been
// blocked", robots.txt included), so the import reads the manufacturer's
// global English site (orient-watch.com, Seiko Epson) and cross-checks it
// against the official UK store (orientwatch.co.uk), which labels its
// lug-to-lug value explicitly.
const GLOBAL_ORIGIN = "https://orient-watch.com";
const SITEMAP_URL = `${GLOBAL_ORIGIN}/sitemap.xml`;
const SEARCH_PAGES = {
  Orient: `${GLOBAL_ORIGIN}/en/orient/search/`,
  "Orient Star": `${GLOBAL_ORIGIN}/en/orientstar/search/`
};
// The site's own search box posts to this index; it lists every English page.
const SEARCH_API = "https://finder.api.mf.marsflag.com/api/v1/finder_service/documents/0f37536d/search";
const SEARCH_API_PAGE_SIZE = 100;
const UK_ORIGIN = "https://www.orientwatch.co.uk";
const UK_LISTINGS = {
  Orient: `${UK_ORIGIN}/or/en_GB/brands/orient/c/orient`,
  "Orient Star": `${UK_ORIGIN}/or/en_GB/brands/orient-star/c/orient-star`
};
const BRAND_BY_PATH = { orient: "Orient", orientstar: "Orient Star" };
// Collection and line slugs use hyphens and, for older Orient Star lines,
// underscores (m34_f8_date).
const PRODUCT_URL_PATTERN =
  /^https:\/\/orient-watch\.com\/en\/(orient|orientstar)\/collection\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/([A-Z]{2}-?[A-Z0-9]+)\/$/u;
const LINE_URL_PATTERN = /^https:\/\/orient-watch\.com\/en\/(orient|orientstar)\/collection\/([a-z0-9_-]+)\/([a-z0-9_-]+)\/$/u;
const CATEGORY_URL_PATTERN = /^https:\/\/orient-watch\.com\/en\/(orient|orientstar)\/collection\/([a-z0-9_-]+)\/$/u;
const UK_PRODUCT_PATH_PATTERN = /^\/or\/en_GB\/[a-z0-9/-]+\/p\/([A-Z]{2}-?[A-Z0-9]+)$/u;
const GLOBAL_SPEC_FIELDS = {
  caseMm: { className: "rt_cf_p_case_width_mm", label: "Case Size (Width)" },
  lugToLugMm: { className: "rt_cf_p_case_length_mm", label: "Case Size (Height)" },
  thicknessMm: { className: "rt_cf_p_case_thickness_mm", label: "Case Size (Thickness)" },
  lugWidthMm: { className: "rt_cf_p_band_width_mm", label: "Strap Width" }
};
const UK_SPEC_FIELDS = {
  caseMm: /^Width\s+(\d+(?:\.\d+)?)\s*mm$/iu,
  lugToLugMm: /^Lug-to-lug\s+(\d+(?:\.\d+)?)\s*mm$/iu,
  thicknessMm: /^Thickness\s+(\d+(?:\.\d+)?)\s*mm$/iu,
  lugWidthMm: /^Lug width\s+(\d+(?:\.\d+)?)\s*mm$/iu
};
const METRIC_FIELDS = ["caseMm", "thicknessMm", "lugToLugMm", "lugWidthMm"];
const FIELD_LABELS = { caseMm: "case width", thicknessMm: "thickness", lugToLugMm: "lug-to-lug", lugWidthMm: "lug width" };
const CACHE_DIR = process.env.ORIENT_CACHE_DIR ?? "/private/tmp/orient-official-catalog";
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
    .replaceAll("&#x3D;", "=")
    .replaceAll("&apos;", "'")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&times;", "×")
    .replaceAll("&ndash;", "–")
    .replaceAll("&mdash;", "—")
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

// Returns { status, body }. curl retries transient failures (timeouts, 429,
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

function absoluteGlobalUrl(href) {
  return decodeEntities(href).startsWith("/") ? `${GLOBAL_ORIGIN}${decodeEntities(href)}` : decodeEntities(href);
}

function productKey(url) {
  const match = url.match(PRODUCT_URL_PATTERN);
  return match ? `${BRAND_BY_PATH[match[1]]}|${match[4]}` : null;
}

function addCandidate(candidates, url, origin) {
  const key = productKey(url);
  if (!key) return;
  const entry = candidates.get(key) ?? candidates.set(key, { key, urls: new Map() }).get(key);
  const origins = entry.urls.get(url) ?? entry.urls.set(url, new Set()).get(url);
  origins.add(origin);
}

// ---------------------------------------------------------------------------
// Global site (orient-watch.com)

function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map((match) => decodeEntities(match[1]));
  return {
    productUrls: locs.filter((url) => PRODUCT_URL_PATTERN.test(url)),
    lineUrls: locs.filter((url) => LINE_URL_PATTERN.test(url)),
    categoryUrls: locs.filter((url) => CATEGORY_URL_PATTERN.test(url))
  };
}

function searchWidgetTotal(html) {
  const value = html.match(/class=["'][^"']*rt_bn_products_list_def_total[^"']*["'][^>]*>\s*(\d+)\s*</u)?.[1];
  const total = Number(value);
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Could not read the product finder total.");
  return total;
}

function collectionLinks(html, pattern) {
  return uniqueValues(
    [...html.matchAll(/href=["']([^"']+)["']/giu)]
      .map((match) => absoluteGlobalUrl(match[1]))
      .filter((url) => pattern.test(url))
  );
}

function specRows(html) {
  const rows = new Map();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cell = row[1].match(/<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*class=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/iu);
    if (!cell) continue;
    const label = inlineText(cell[1]);
    const text = inlineText(cell[3]);
    for (const className of cell[2].split(/\s+/u)) {
      if (!className.startsWith("rt_cf_p_")) continue;
      const seen = rows.get(className);
      if (seen && (seen.label !== label || seen.text !== text)) {
        throw new Error(`Conflicting specification rows for ${className}: ${JSON.stringify([seen, { label, text }])}`);
      }
      rows.set(className, { label, text });
    }
  }
  return rows;
}

function parseGlobalProduct(url, html) {
  const [, brandPath, , , urlReference] = url.match(PRODUCT_URL_PATTERN);
  const reference = requiredSingle(
    [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) => inlineText(match[1])),
    "product heading"
  );
  if (reference !== urlReference) throw new Error(`URL/reference mismatch: ${urlReference} / ${reference}`);
  const canonical = requiredSingle(
    [...html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/giu)].map((match) =>
      decodeEntities(match[1])
    ),
    "canonical URL"
  );
  if (canonical !== url) throw new Error(`Canonical URL differs: ${canonical}`);
  const line = requiredSingle(
    [...html.matchAll(/class=["'][^"']*rt_cf_p_petname_petname[^"']*["'][^>]*>([^<]*)</giu)].map((match) =>
      inlineText(match[1])
    ),
    "line name"
  );
  const collection = requiredSingle(
    [...html.matchAll(/class=["'][^"']*rt_cf_p_petname_collection[^"']*["'][^>]*>([^<]*)</giu)].map((match) =>
      inlineText(match[1])
    ),
    "collection name"
  );

  const rows = specRows(html);
  const metrics = {};
  const texts = {};
  const conflicts = [];
  for (const [field, { className, label }] of Object.entries(GLOBAL_SPEC_FIELDS)) {
    const row = rows.get(className);
    if (!row) {
      metrics[field] = null;
      texts[field] = null;
      continue;
    }
    if (row.label !== label) throw new Error(`Unexpected label for ${className}: ${row.label}`);
    const values = millimetres(row.text);
    if (values.length !== 1) {
      conflicts.push({ field, text: row.text });
      metrics[field] = null;
      texts[field] = row.text;
      continue;
    }
    metrics[field] = values[0];
    texts[field] = row.text;
  }

  return {
    source: "global",
    url,
    brand: BRAND_BY_PATH[brandPath],
    reference,
    line,
    collection,
    metrics,
    texts,
    conflicts
  };
}

// ---------------------------------------------------------------------------
// UK store (orientwatch.co.uk)

function parseUkListing(html) {
  const paginationText = inlineText(html.match(/class=["'][^"']*pagination-count[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|nav|ul)>/iu)?.[1] ?? "");
  const pagination = paginationText.match(/Page\s*(\d+)\s*of\s*(\d+)/iu);
  const productPaths = uniqueValues(
    [...html.matchAll(/href=["'](\/or\/en_GB\/[^"'?#]+\/p\/[A-Z0-9-]+)["']/gu)].map((match) => decodeEntities(match[1]))
  ).filter((path) => UK_PRODUCT_PATH_PATTERN.test(path));
  const next = html.match(/<a\b[^>]*title=["']Next["'][^>]*href=["']([^"']+)["']/iu)?.[1] ?? null;
  return {
    page: pagination ? Number(pagination[1]) : null,
    pageCount: pagination ? Number(pagination[2]) : null,
    productPaths,
    nextUrl: next ? `${UK_ORIGIN}${decodeEntities(next)}` : null
  };
}

function ukAccordionGroups(html) {
  const groups = new Map();
  for (const match of html.matchAll(
    /accordion-toggle__title[^>]*>\s*([^<]*?)\s*<\/span>[\s\S]*?accordion-toggle__group[^>]*>([\s\S]*?)<\/div>/giu
  )) {
    const title = inlineText(match[1]);
    const lines = textContent(match[2]).split("\n").map((line) => line.trim()).filter(Boolean);
    const existing = groups.get(title);
    if (existing && JSON.stringify(existing) !== JSON.stringify(lines)) {
      throw new Error(`Conflicting "${title}" details: ${JSON.stringify([existing, lines])}`);
    }
    groups.set(title, lines);
  }
  return groups;
}

function parseUkProduct(url, html) {
  const reference = new URL(url).pathname.match(UK_PRODUCT_PATH_PATTERN)?.[1];
  if (!reference) throw new Error(`Unexpected UK product URL: ${url}`);
  const itemIds = uniqueValues(
    [...html.matchAll(/property=["']product:retailer_item_id["']\s+content=["']([^"']+)["']/giu)].map((match) =>
      inlineText(match[1])
    )
  );
  if (itemIds.length !== 1 || itemIds[0] !== reference) {
    throw new Error(`UK URL/item id mismatch: ${reference} / ${JSON.stringify(itemIds)}`);
  }
  const name = requiredSingle(
    [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu)].map((match) => inlineText(match[1])),
    "UK product name"
  );
  const groups = ukAccordionGroups(html);
  const caseLines = groups.get("Case") ?? [];
  const metrics = {};
  const texts = {};
  const conflicts = [];
  for (const [field, pattern] of Object.entries(UK_SPEC_FIELDS)) {
    const matches = uniqueValues(caseLines.filter((line) => pattern.test(line)));
    if (matches.length > 1) {
      conflicts.push({ field, text: matches.join(" / ") });
      metrics[field] = null;
      texts[field] = matches.join(" / ");
      continue;
    }
    metrics[field] = matches.length ? Number(matches[0].match(pattern)[1]) : null;
    texts[field] = matches[0] ?? null;
  }
  return { source: "uk", url, reference, name, caseLines, metrics, texts, conflicts };
}

// ---------------------------------------------------------------------------

async function crawlGlobal() {
  const sitemap = parseSitemap(await requirePage(SITEMAP_URL));
  const candidates = new Map();
  for (const url of sitemap.productUrls) addCandidate(candidates, url, "sitemap");

  const widgetTotals = {};
  for (const [brand, url] of Object.entries(SEARCH_PAGES)) widgetTotals[brand] = searchWidgetTotal(await requirePage(url));

  let searchHits = null;
  let searchPages = 0;
  let searchProductUrls = 0;
  for (let page = 1; ; page += 1) {
    const body = await requirePage(`${SEARCH_API}?q=*:*&number_per_page=${SEARCH_API_PAGE_SIZE}&page_number=${page}`);
    const result = JSON.parse(body);
    searchHits = result.organic.hits;
    searchPages += 1;
    const docs = result.organic.docs ?? [];
    for (const doc of docs) {
      if (PRODUCT_URL_PATTERN.test(doc.url)) {
        addCandidate(candidates, doc.url, "search-index");
        searchProductUrls += 1;
      }
    }
    if (docs.length < SEARCH_API_PAGE_SIZE || page * SEARCH_API_PAGE_SIZE >= searchHits) break;
  }

  const lineUrls = new Set(sitemap.lineUrls);
  const categoryUrls = new Set(sitemap.categoryUrls);
  for (const url of categoryUrls) {
    for (const lineUrl of collectionLinks(await requirePage(url), LINE_URL_PATTERN)) lineUrls.add(lineUrl);
  }
  const lineProducts = [];
  for (const url of [...lineUrls].sort()) {
    const productUrls = collectionLinks(await requirePage(url), PRODUCT_URL_PATTERN);
    lineProducts.push({ url, productCount: productUrls.length });
    for (const productUrl of productUrls) addCandidate(candidates, productUrl, "line-page");
  }

  const products = [];
  const failures = [];
  const staleUrls = [];
  const unresolved = [];
  const staleListings = [];
  let visited = 0;
  for (const entry of candidates.values()) {
    // Prefer the URL the current collection pages link to; stale sitemap or
    // search-index paths for the same reference return 404.
    const urls = [...entry.urls.entries()]
      .sort(([, a], [, b]) => Number(b.has("line-page")) - Number(a.has("line-page")))
      .map(([url]) => url);
    let product = null;
    for (const url of urls) {
      try {
        const html = await loadPage(url);
        visited += 1;
        if (html == null) {
          staleUrls.push({ key: entry.key, url, origins: [...entry.urls.get(url)] });
          continue;
        }
        product = parseGlobalProduct(url, html);
        product.origins = [...new Set(urls.flatMap((candidate) => [...entry.urls.get(candidate)]))];
        break;
      } catch (error) {
        failures.push({ url, error: String(error?.message ?? error) });
        break;
      }
    }
    if (product) products.push(product);
    else if (!failures.some((failure) => urls.includes(failure.url))) {
      // A reference only the sitemap or search index still lists, with every
      // URL returning 404, is a stale listing; a 404 behind a current
      // collection page link is a crawl problem.
      const linkedFromLinePage = [...entry.urls.values()].some((origins) => origins.has("line-page"));
      (linkedFromLinePage ? unresolved : staleListings).push({ key: entry.key, urls });
    }
    process.stderr.write(`\rglobal ${visited} requests, ${products.length}/${candidates.size} products`);
  }
  process.stderr.write("\n");

  return {
    sitemapProductUrls: sitemap.productUrls.length,
    sitemapReferences: new Set(sitemap.productUrls.map(productKey)).size,
    widgetTotals,
    searchHits,
    searchPages,
    searchProductUrls,
    lineUrls: lineUrls.size,
    lineProducts,
    candidateReferences: candidates.size,
    candidateOrigins: Object.fromEntries(
      ["sitemap", "search-index", "line-page"].map((origin) => [
        origin,
        [...candidates.values()].filter((entry) => [...entry.urls.values()].some((origins) => origins.has(origin))).length
      ])
    ),
    products,
    failures,
    staleUrls,
    staleListings,
    unresolved
  };
}

async function crawlUk() {
  const listings = {};
  const products = [];
  const failures = [];
  for (const [brand, firstUrl] of Object.entries(UK_LISTINGS)) {
    const pages = [];
    const productPaths = new Set();
    let declaredPages = null;
    let url = firstUrl;
    while (url) {
      const listing = parseUkListing(await requirePage(url));
      if (declaredPages == null) declaredPages = listing.pageCount;
      pages.push({ url, page: listing.page, products: listing.productPaths.length });
      for (const path of listing.productPaths) productPaths.add(path);
      if (pages.length > 50) throw new Error(`UK listing for ${brand} did not end after 50 pages.`);
      url = listing.nextUrl;
    }
    listings[brand] = { declaredPages, crawledPages: pages.length, productPaths: productPaths.size };
    for (const path of productPaths) {
      const productUrl = `${UK_ORIGIN}${path}`;
      try {
        const product = parseUkProduct(productUrl, await requirePage(productUrl));
        product.brand = brand;
        products.push(product);
      } catch (error) {
        failures.push({ url: productUrl, error: String(error?.message ?? error) });
      }
      process.stderr.write(`\ruk ${products.length + failures.length} products`);
    }
  }
  process.stderr.write("\n");
  return { listings, products, failures };
}

function stripBrandPrefix(name, brand) {
  const escaped = brand.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return name.replace(new RegExp(`^${escaped}\\s+`, "iu"), "").trim() || name;
}

function globalNote(product) {
  const { texts, brand, reference } = product;
  const parts = [
    texts.caseMm == null ? null : `${texts.caseMm} case width`,
    texts.lugToLugMm == null ? null : `${texts.lugToLugMm} case height (the page's case length field, stored as lug-to-lug)`,
    texts.thicknessMm == null ? null : `${texts.thicknessMm} case thickness`,
    texts.lugWidthMm == null ? null : `${texts.lugWidthMm} strap width (stored as lug width)`
  ].filter(Boolean);
  return `Official ${brand} product page (orient-watch.com) lists ${reference} with ${parts.join(", ")}.`;
}

function ukNote(product) {
  const { texts, brand, reference } = product;
  const parts = [texts.caseMm, texts.lugToLugMm, texts.thicknessMm, texts.lugWidthMm]
    .filter(Boolean)
    .map((text) => text.replace(/^(Width|Lug-to-lug|Thickness|Lug width)\s+(\S+)$/iu, "$2 $1").toLowerCase());
  return `Official ${brand} UK store product page lists ${reference} with ${parts.join(", ")}.`;
}

// A US or regional catalog number is the base reference plus a regional
// suffix: RA-AC0033Y30B for RA-AC0033Y, FAC00009N0 or TAC00009N0 for
// AC00009N.
function isRegionalVariant(existingCompact, officialCompact) {
  if (existingCompact === officialCompact) return true;
  if (existingCompact.startsWith(officialCompact)) {
    return /^\d{2}[A-Z]$/u.test(existingCompact.slice(officialCompact.length));
  }
  if (/^[FST]/u.test(existingCompact) && existingCompact.slice(1).startsWith(officialCompact)) {
    return /^\d?$/u.test(existingCompact.slice(1 + officialCompact.length));
  }
  return false;
}

const global = await crawlGlobal();
const uk = await crawlUk();

const ukByReference = new Map();
for (const product of uk.products) {
  if (ukByReference.has(product.reference)) throw new Error(`UK reference listed twice: ${product.reference}`);
  ukByReference.set(product.reference, product);
}
const globalByReference = new Map();
for (const product of global.products) {
  if (globalByReference.has(product.reference)) throw new Error(`Global reference parsed twice: ${product.reference}`);
  globalByReference.set(product.reference, product);
}

// Combine both official sources per reference. Values published by both must
// agree; otherwise the reference is excluded rather than resolved by guesswork.
const combined = [];
const crossSourceConflicts = [];
const withoutDimensions = [];
const pageConflicts = [];
const brandMismatches = [];
for (const reference of new Set([...globalByReference.keys(), ...ukByReference.keys()])) {
  const globalProduct = globalByReference.get(reference) ?? null;
  const ukProduct = ukByReference.get(reference) ?? null;
  const conflicts = [...(globalProduct?.conflicts ?? []), ...(ukProduct?.conflicts ?? [])];
  if (conflicts.length) {
    pageConflicts.push({ reference, conflicts, urls: [globalProduct?.url, ukProduct?.url].filter(Boolean) });
    continue;
  }
  if (globalProduct && ukProduct && globalProduct.brand !== ukProduct.brand) {
    brandMismatches.push({ reference, global: globalProduct.brand, uk: ukProduct.brand });
    continue;
  }
  // Where the two official pages disagree, the disputed value is not stored:
  // a disputed case size or lug-to-lug excludes the reference, a disputed
  // thickness or lug width is left empty and both values go into the notes.
  const disagreements = METRIC_FIELDS.filter(
    (field) =>
      globalProduct?.metrics[field] != null &&
      ukProduct?.metrics[field] != null &&
      globalProduct.metrics[field] !== ukProduct.metrics[field]
  );
  if (disagreements.length) {
    crossSourceConflicts.push({
      reference,
      fields: disagreements,
      resolution: disagreements.some((field) => field === "caseMm" || field === "lugToLugMm")
        ? "excluded"
        : "disputed fields left empty",
      global: { url: globalProduct.url, ...globalProduct.metrics },
      uk: { url: ukProduct.url, ...ukProduct.metrics }
    });
    if (disagreements.some((field) => field === "caseMm" || field === "lugToLugMm")) continue;
  }
  const metrics = Object.fromEntries(
    METRIC_FIELDS.map((field) => [
      field,
      disagreements.includes(field) ? null : (globalProduct?.metrics[field] ?? ukProduct?.metrics[field] ?? null)
    ])
  );
  const disputeNote = disagreements.length
    ? ` The two official pages disagree on ${disagreements
        .map((field) => `${FIELD_LABELS[field]} (${globalProduct.metrics[field]} mm / ${ukProduct.metrics[field]} mm)`)
        .join(" and ")}, so the import takes no ${disagreements.map((field) => FIELD_LABELS[field]).join(" or ")} from them.`
    : "";
  if (metrics.caseMm == null || metrics.lugToLugMm == null) {
    withoutDimensions.push({
      reference,
      brand: (globalProduct ?? ukProduct).brand,
      urls: [globalProduct?.url, ukProduct?.url].filter(Boolean),
      ...metrics
    });
    continue;
  }
  const brand = (globalProduct ?? ukProduct).brand;
  const model = stripBrandPrefix(
    ukProduct ? ukProduct.name : globalProduct.line.toLowerCase() === "others" ? globalProduct.collection : globalProduct.line,
    brand
  );
  combined.push({
    reference,
    brand,
    model,
    nameSource: ukProduct ? "uk" : globalProduct.line.toLowerCase() === "others" ? "global-collection" : "global-line",
    metrics,
    sources: [
      globalProduct ? { sourceUrl: globalProduct.url, note: `${globalNote(globalProduct)}${disputeNote}` } : null,
      ukProduct ? { sourceUrl: ukProduct.url, note: `${ukNote(ukProduct)}${disputeNote}` } : null
    ].filter(Boolean),
    coverage: globalProduct && ukProduct ? "both" : globalProduct ? "global" : "uk"
  });
}
combined.sort((a, b) => a.brand.localeCompare(b.brand) || a.reference.localeCompare(b.reference));

const invalidProducts = combined.filter(
  ({ metrics }) =>
    metrics.caseMm <= 0 ||
    metrics.caseMm > 100 ||
    metrics.lugToLugMm <= 0 ||
    metrics.lugToLugMm > 100 ||
    metrics.lugToLugMm < metrics.caseMm ||
    (metrics.thicknessMm != null && (metrics.thicknessMm <= 0 || metrics.thicknessMm > 50)) ||
    (metrics.lugWidthMm != null && (metrics.lugWidthMm <= 0 || metrics.lugWidthMm > 50))
);
const agreementCount = combined.filter((product) => product.coverage === "both").length;

const refusals = [];
if (global.failures.length) refusals.push(`${global.failures.length} global product page(s) failed to load or parse`);
if (uk.failures.length) refusals.push(`${uk.failures.length} UK product page(s) failed to load or parse`);
for (const [brand, listing] of Object.entries(uk.listings)) {
  if (listing.declaredPages != null && listing.declaredPages !== listing.crawledPages) {
    refusals.push(`UK ${brand} listing declares ${listing.declaredPages} pages but ${listing.crawledPages} were crawled`);
  }
}
if (global.unresolved.length) refusals.push(`${global.unresolved.length} listed reference(s) have no reachable product page`);
if (brandMismatches.length) refusals.push(`${brandMismatches.length} reference(s) are filed under different brands`);
if (invalidProducts.length) refusals.push(`${invalidProducts.length} product(s) have invalid official dimensions`);
if (SHOULD_WRITE && refusals.length) {
  throw new Error(`Refusing to write the Orient import: ${refusals.join("; ")}.`);
}

const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
const brands = new Set(Object.values(BRAND_BY_PATH));
const existingRecords = seed.filter((watch) => brands.has(watch.brand));
let nextId = Math.max(...seed.map((watch) => watch.id)) + 1;
const added = [];
const updated = [];
const unchanged = [];
const corrections = [];
const keptExistingMetrics = [];
const nameDifferences = [];
const matchedExistingIds = new Set();

for (const product of combined) {
  const officialCompact = compactReference(product.reference);
  const matches = existingRecords.filter(
    (watch) => watch.brand === product.brand && isRegionalVariant(compactReference(watch.reference), officialCompact)
  );

  if (matches.length === 0) {
    const watch = {
      id: nextId++,
      brand: product.brand,
      model: product.model,
      reference: product.reference,
      lugToLugMm: product.metrics.lugToLugMm,
      caseMm: product.metrics.caseMm,
      thicknessMm: product.metrics.thicknessMm,
      lugWidthMm: product.metrics.lugWidthMm,
      sources: product.sources
    };
    seed.push(watch);
    added.push({
      id: watch.id,
      brand: watch.brand,
      reference: watch.reference,
      model: watch.model,
      nameSource: product.nameSource,
      coverage: product.coverage,
      ...product.metrics
    });
    continue;
  }

  for (const existing of matches) {
    matchedExistingIds.add(existing.id);
    const existingMetrics = Object.fromEntries(METRIC_FIELDS.map((field) => [field, existing[field] ?? null]));
    const applied = {};
    const kept = {};
    for (const field of METRIC_FIELDS) {
      if (product.metrics[field] == null) {
        if (existingMetrics[field] != null) kept[field] = existingMetrics[field];
        continue;
      }
      if (existingMetrics[field] !== product.metrics[field]) applied[field] = product.metrics[field];
    }
    if (Object.keys(applied).length) {
      corrections.push({
        id: existing.id,
        reference: existing.reference,
        officialReference: product.reference,
        model: existing.model,
        existing: existingMetrics,
        official: product.metrics,
        urls: product.sources.map((source) => source.sourceUrl)
      });
    }
    if (Object.keys(kept).length) {
      keptExistingMetrics.push({ id: existing.id, reference: existing.reference, kept });
    }
    if (existing.model !== product.model) {
      nameDifferences.push({ id: existing.id, reference: existing.reference, stored: existing.model, official: product.model });
    }

    let changed = false;
    for (const [field, value] of Object.entries(applied)) {
      existing[field] = value;
      changed = true;
    }
    // Official sources go in front of the existing ones, in their own order.
    for (const source of [...product.sources].reverse()) {
      const existingSource = existing.sources.find((candidate) => candidate.sourceUrl === source.sourceUrl);
      if (existingSource) {
        if (existingSource.note !== source.note) {
          existingSource.note = source.note;
          changed = true;
        }
      } else {
        existing.sources.unshift(source);
        changed = true;
      }
    }
    if (changed) updated.push({ id: existing.id, reference: existing.reference, officialReference: product.reference });
    else unchanged.push({ id: existing.id, reference: existing.reference });
  }
}

const existingWithoutOfficialMatch = existingRecords
  .filter((watch) => !matchedExistingIds.has(watch.id))
  .map((watch) => ({ id: watch.id, brand: watch.brand, reference: watch.reference, model: watch.model }));

if (SHOULD_WRITE) await writeFile(SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`);

const countBy = (items, pick) =>
  items.reduce((counts, item) => {
    const key = pick(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

console.log(
  JSON.stringify(
    {
      global: {
        sitemapProductUrls: global.sitemapProductUrls,
        sitemapReferences: global.sitemapReferences,
        productFinderTotals: global.widgetTotals,
        searchIndexHits: global.searchHits,
        searchIndexPages: global.searchPages,
        searchIndexProductUrls: global.searchProductUrls,
        linePages: global.lineUrls,
        candidateReferences: global.candidateReferences,
        candidateOrigins: global.candidateOrigins,
        parsedProducts: global.products.length,
        parsedByBrand: countBy(global.products, (product) => product.brand),
        staleUrls: global.staleUrls.length,
        staleListings: global.staleListings,
        unresolved: global.unresolved,
        failures: global.failures
      },
      uk: {
        listings: uk.listings,
        parsedProducts: uk.products.length,
        parsedByBrand: countBy(uk.products, (product) => product.brand),
        failures: uk.failures
      },
      combined: {
        importable: combined.length,
        byBrand: countBy(combined, (product) => product.brand),
        byCoverage: countBy(combined, (product) => product.coverage),
        byNameSource: countBy(combined, (product) => product.nameSource),
        referencesOnBothSites: agreementCount,
        crossSourceConflicts,
        pageConflicts,
        brandMismatches,
        withoutDimensions,
        invalidProducts
      },
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

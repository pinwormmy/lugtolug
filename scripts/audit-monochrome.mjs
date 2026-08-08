import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_API_URL = "https://monochrome-watches.com/wp-json/wp/v2/posts";
const DEFAULT_OUTPUT_PATH = "/private/tmp/monochrome-lug-audit.json";
const USER_AGENT = "lugtolug-finder/1.0 (+https://lugtolugfinder.com)";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function positiveIntegerArgument(name, fallback) {
  const value = Number(argumentValue(name) ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} must be a positive integer.`);
  return value;
}

const outputPath = resolve(argumentValue("output") ?? DEFAULT_OUTPUT_PATH);
const apiUrl = argumentValue("api-url") ?? DEFAULT_API_URL;
const apiFile = argumentValue("api-file");
const concurrency = positiveIntegerArgument("concurrency", 2);
const delayMs = positiveIntegerArgument("delay-ms", 350);
const requestTimeoutMs = positiveIntegerArgument("timeout-ms", 60_000);
const checkpointEvery = positiveIntegerArgument("checkpoint-every", 10);
const requestedPages = argumentValue("pages") ? positiveIntegerArgument("pages", 1) : null;
const perPage = 100;

const DIRECT_SIGNAL = /(?:\bl\s*2\s*l\b|lug(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*lug)/iu;
const INDIRECT_SIGNALS = [
  /lug\s+tip(?:s)?(?:\s|\u00a0|[-\u2010-\u2015])*(?:to|[-\u2010-\u2015])(?:\s|\u00a0|[-\u2010-\u2015])*lug\s+tip/iu,
  /tip(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*tip/iu,
  /north(?:\s|\u00a0|[-\u2010-\u2015])*(?:to(?:\s|\u00a0|[-\u2010-\u2015])*)?south/iu,
  /top(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*bottom/iu,
  /end(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*end/iu,
  /(?:across|spans?)\s+(?:the\s+)?wrist/iu,
  /wrist(?:\s|\u00a0|[-\u2010-\u2015])*(?:span|length|measurement)/iu,
  /(?:overall|total)\s+(?:case\s+)?(?:length|height)/iu,
  /case\s+(?:length|height)/iu,
  /(?:vertical|longitudinal)\s+(?:case\s+)?(?:dimension|measurement|length|height)/iu,
  /(?:vertically|long\s+axis|12\s*(?:to|[-\u2010-\u2015])\s*6)/iu,
  /(?:length|height)\s+(?:of\s+)?(?:the\s+)?(?:case|watch)/iu,
  /\b(?:length|height)\s*(?::|is|of|measures?|at)?[^.!?\n]{0,35}\b\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\b/iu,
  /\b\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\s+(?:in\s+)?(?:overall\s+)?(?:length|height)\b/iu,
  /\b(?:measures?|spans?)\s+\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\s+(?:in\s+)?(?:length|height|the\s+long\s+axis)\b/iu,
  /(?:case|watch)[^.!?\n]{0,100}\b\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\s+(?:long|tall|high)\b/iu,
  /\b\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\s+(?:long|tall|high)\b[^.!?\n]{0,100}(?:case|watch|lug)/iu
];
const DIMENSION_PAIR = /\b\d{1,2}(?:[.,]\d+)?\s*(?:(?:mm|millimet(?:er|re)s?)\s*)?(?:[x\u00d7]|by)\s*\d{1,2}(?:[.,]\d+)?(?:\s*(?:(?:mm|millimet(?:er|re)s?)\s*)?(?:[x\u00d7]|by)\s*\d{1,2}(?:[.,]\d+)?)?\s*(?:mm|millimet(?:er|re)s?)\b/iu;
const MILLIMETER_VALUE = /\b\d{1,2}(?:[.,]\d+)?\s*(?:mm|millimet(?:er|re)s?)\b/iu;

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&times;/giu, "\u00d7")
    .replace(/&ndash;/giu, "\u2013")
    .replace(/&mdash;/giu, "\u2014")
    .replace(/&hellip;/giu, "\u2026")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">");
}

function stripMarkup(html) {
  return decodeHtml(
    String(html ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
      .replace(/<br\s*\/?\s*>/giu, "\n")
      .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section|tr|table)>/giu, "\n")
      .replace(/<\/(?:td|th)>/giu, ": ")
      .replace(/<[^>]+>/gu, " ")
  )
    .replace(/\r/gu, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/gu, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function signalNames(paragraph) {
  const signals = [];
  if (DIRECT_SIGNAL.test(paragraph)) signals.push("direct-lug-to-lug");
  if (/\blugs?\b/iu.test(paragraph) && MILLIMETER_VALUE.test(paragraph)) signals.push("lug-related-dimension");
  for (const pattern of INDIRECT_SIGNALS) {
    if (pattern.test(paragraph) && MILLIMETER_VALUE.test(paragraph)) {
      signals.push("semantic-case-length");
      break;
    }
  }
  if (DIMENSION_PAIR.test(paragraph) && /(?:case|watch|dimension|measure|size|lug|thick|diameter)/iu.test(paragraph)) {
    signals.push("dimension-pair");
  }
  return signals;
}

function matchedContexts(text) {
  const paragraphs = text.split("\n");
  const contexts = [];

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const signals = signalNames(paragraph);
    if (!signals.length) continue;

    const previous = paragraphs[index - 1] ?? "";
    const next = paragraphs[index + 1] ?? "";
    const context = [previous, paragraph, next].filter(Boolean).join("\n").slice(0, 5_000);
    if (!contexts.some((candidate) => candidate.context === context)) contexts.push({ signals, context });
  }

  return contexts;
}

function apiPageUrl(page) {
  const url = new URL(apiUrl);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("orderby", "id");
  url.searchParams.set("order", "asc");
  url.searchParams.set("_fields", "id,date,modified,link,slug,title,content,categories");
  return url.toString();
}

function categoryPageUrl(page) {
  const url = new URL("https://monochrome-watches.com/wp-json/wp/v2/categories");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("orderby", "id");
  url.searchParams.set("order", "asc");
  url.searchParams.set("_fields", "id,name,slug,parent");
  return url.toString();
}

async function fetchJsonPage(page, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(apiPageUrl(page), {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const posts = await response.json();
      return {
        posts,
        totalPosts: Number(response.headers.get("x-wp-total")),
        totalPages: Number(response.headers.get("x-wp-totalpages"))
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(750 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function fetchCategoryPage(page, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(categoryPageUrl(page), {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        categories: await response.json(),
        totalPages: Number(response.headers.get("x-wp-totalpages"))
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(750 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function atomicWriteJson(path, value) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

function auditPost(post, categoryNamesById) {
  const text = stripMarkup(post.content?.rendered);
  const contexts = matchedContexts(text);
  if (!contexts.length) return null;

  return {
    id: post.id,
    url: post.link,
    slug: post.slug,
    publishedAt: post.date,
    lastModified: post.modified,
    title: stripMarkup(post.title?.rendered),
    categories: (post.categories ?? []).map((id) => categoryNamesById.get(id)).filter(Boolean),
    signals: [...new Set(contexts.flatMap((item) => item.signals))],
    contexts,
    text
  };
}

let pages;
let siteArticleCount;
const categoryNamesById = new Map();
if (apiFile) {
  const posts = JSON.parse(await readFile(resolve(apiFile), "utf8"));
  pages = [{ page: 1, posts }];
  siteArticleCount = posts.length;
} else {
  const firstCategoryPage = await fetchCategoryPage(1);
  const categoryPages = [
    firstCategoryPage.categories,
    ...await Promise.all(
      Array.from({ length: firstCategoryPage.totalPages - 1 }, (_, index) => fetchCategoryPage(index + 2).then((page) => page.categories))
    )
  ];
  for (const category of categoryPages.flat()) categoryNamesById.set(category.id, stripMarkup(category.name));

  const first = await fetchJsonPage(1);
  const pageCount = requestedPages ? Math.min(requestedPages, first.totalPages) : first.totalPages;
  siteArticleCount = first.totalPosts;
  pages = [{ page: 1, posts: first.posts }, ...Array.from({ length: pageCount - 1 }, (_, index) => ({ page: index + 2 }))];
}

const startedAt = new Date().toISOString();
const candidates = [];
const failures = [];
let completedPages = 0;
let completedArticles = 0;
let nextIndex = 0;

function auditPayload() {
  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    apiUrl,
    siteArticleCount,
    requestedPageCount: pages.length,
    requestedArticleCount: requestedPages ? Math.min(siteArticleCount, pages.length * perPage) : siteArticleCount,
    completedPageCount: completedPages,
    completedArticleCount: completedArticles,
    candidateCount: candidates.length,
    failureCount: failures.length,
    failures: [...failures].sort((left, right) => left.page - right.page),
    candidates: [...candidates].sort((left, right) => left.id - right.id)
  };
}

async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= pages.length) return;
    const page = pages[index];

    try {
      const posts = page.posts ?? (await fetchJsonPage(page.page)).posts;
      for (const post of posts) {
        const candidate = auditPost(post, categoryNamesById);
        if (candidate) candidates.push(candidate);
      }
      completedArticles += posts.length;
    } catch (error) {
      failures.push({ page: page.page, error: error instanceof Error ? error.message : String(error) });
    }

    completedPages += 1;
    if (completedPages % 5 === 0 || completedPages === pages.length) {
      process.stdout.write(
        `Audited ${completedPages}/${pages.length} pages (${completedArticles} articles); ` +
          `candidates=${candidates.length}; failures=${failures.length}\n`
      );
    }
    if (completedPages % checkpointEvery === 0) await atomicWriteJson(outputPath, auditPayload());
    await sleep(delayMs);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, pages.length) }, () => worker()));
await atomicWriteJson(outputPath, auditPayload());

if (failures.length) {
  process.stderr.write(`Completed with ${failures.length} failed API page(s). See ${outputPath}.\n`);
  process.exitCode = 2;
} else {
  process.stdout.write(`Complete MONOCHROME audit written to ${outputPath}.\n`);
}

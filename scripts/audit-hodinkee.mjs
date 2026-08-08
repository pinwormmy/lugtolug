import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DEFAULT_SITEMAP_URL = "https://www.hodinkee.com/sitemap.xml";
const DEFAULT_OUTPUT_PATH = "/private/tmp/hodinkee-lug-audit.json";
const USER_AGENT = "lugtolug-finder/1.0 (+https://lugtolugfinder.com)";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function positiveIntegerArgument(name, fallback) {
  const value = Number(argumentValue(name) ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer.`);
  }
  return value;
}

const outputPath = resolve(argumentValue("output") ?? DEFAULT_OUTPUT_PATH);
const sitemapFile = argumentValue("sitemap-file");
const sitemapUrl = argumentValue("sitemap-url") ?? DEFAULT_SITEMAP_URL;
const concurrency = positiveIntegerArgument("concurrency", 6);
const delayMs = positiveIntegerArgument("delay-ms", 200);
const requestTimeoutMs = positiveIntegerArgument("timeout-ms", 30_000);
const checkpointEvery = positiveIntegerArgument("checkpoint-every", 250);
const requestedLimit = argumentValue("limit") ? positiveIntegerArgument("limit", 1) : null;

const DIRECT_SIGNAL = /(?:\bl\s*2\s*l\b|lug(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*lug)/iu;
const INDIRECT_SIGNALS = [
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
  /\b(?:length|height)\s*(?::|is|of|measures?)?[^.!?\n]{0,30}\b\d{1,2}(?:\.\d+)?\s*mm\b/iu,
  /\b\d{1,2}(?:\.\d+)?\s*mm\s+(?:in\s+)?(?:overall\s+)?(?:length|height)\b/iu,
  /\b(?:measures?|spans?)\s+\d{1,2}(?:\.\d+)?\s*mm\s+(?:in\s+)?(?:length|height|the\s+long\s+axis)\b/iu,
  /(?:case|watch)[^.!?\n]{0,80}\b\d{1,2}(?:\.\d+)?\s*mm\s+(?:long|tall|high)\b/iu,
  /\b\d{1,2}(?:\.\d+)?\s*mm\s+(?:long|tall|high)\b[^.!?\n]{0,80}(?:case|watch|lug)/iu
];
const DIMENSION_PAIR = /\b\d{1,2}(?:\.\d+)?\s*(?:mm\s*)?(?:[x\u00d7]|by)\s*\d{1,2}(?:\.\d+)?\s*mm\b/iu;
const MILLIMETER_VALUE = /\b\d{1,2}(?:\.\d+)?\s*mm\b/iu;

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/giu, " ")
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
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
      .replace(/<br\s*\/?\s*>/giu, "\n")
      .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section)>/giu, "\n")
      .replace(/<[^>]+>/gu, " ")
  )
    .replace(/\r/gu, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/gu, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function articleRegion(html) {
  const starts = [
    html.indexOf('<div class="article-content">'),
    html.indexOf('<div class="article-content '),
    html.indexOf("<article")
  ].filter((index) => index >= 0);
  const start = starts.length ? Math.min(...starts) : 0;
  const possibleEnds = [
    html.indexOf('<section class="related-articles', start),
    html.indexOf('<div class="comments-', start),
    html.indexOf("<footer", start)
  ].filter((index) => index > start);
  const end = possibleEnds.length ? Math.min(...possibleEnds) : html.length;
  return html.slice(start, end);
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const propertyFirst = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "iu"));
  const contentFirst = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["']`, "iu"));
  return decodeHtml(propertyFirst?.[1] ?? contentFirst?.[1] ?? "").trim() || null;
}

function titleFromHtml(html) {
  const metaTitle = metaContent(html, "og:title");
  if (metaTitle) return metaTitle;
  const title = html.match(/<title>([\s\S]*?)<\/title>/iu)?.[1];
  return title ? stripMarkup(title) : null;
}

function publicationDateFromHtml(html) {
  const jsonLdDate = html.match(/["']datePublished["']\s*:\s*["']([^"']+)["']/iu)?.[1];
  return jsonLdDate ?? metaContent(html, "article:published_time");
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
  if (DIMENSION_PAIR.test(paragraph) && /(?:case|watch|dimension|measure|size|lug)/iu.test(paragraph)) {
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
    const context = [previous, paragraph, next].filter(Boolean).join("\n").slice(0, 4_000);
    if (!contexts.some((candidate) => candidate.context === context)) {
      contexts.push({ signals, context });
    }
  }

  return contexts;
}

function sitemapEntries(xml) {
  const entries = [];
  const urlPattern = /<url>([\s\S]*?)<\/url>/giu;
  for (const match of xml.matchAll(urlPattern)) {
    const url = decodeHtml(match[1].match(/<loc>([^<]+)<\/loc>/iu)?.[1] ?? "").trim();
    if (!url.startsWith("https://www.hodinkee.com/articles/")) continue;
    const lastModified = match[1].match(/<lastmod>([^<]+)<\/lastmod>/iu)?.[1] ?? null;
    entries.push({ url, lastModified });
  }
  return entries;
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "user-agent": USER_AGENT
        },
        redirect: "follow",
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}

async function readSitemap() {
  if (sitemapFile) return readFile(resolve(sitemapFile), "utf8");
  return fetchText(sitemapUrl);
}

async function atomicWriteJson(path, value) {
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporaryPath, path);
}

const sitemapXml = await readSitemap();
const allEntries = sitemapEntries(sitemapXml);
const entries = requestedLimit ? allEntries.slice(0, requestedLimit) : allEntries;
if (!entries.length) throw new Error("No Hodinkee article URLs were found in the sitemap.");

const startedAt = new Date().toISOString();
const candidates = [];
const failures = [];
let completed = 0;
let nextIndex = 0;

function auditDocument(entry, html) {
  const text = stripMarkup(articleRegion(html));
  const contexts = matchedContexts(text);
  if (!contexts.length) return;

  candidates.push({
    url: entry.url,
    lastModified: entry.lastModified,
    publishedAt: publicationDateFromHtml(html),
    title: titleFromHtml(html),
    signals: [...new Set(contexts.flatMap((item) => item.signals))],
    contexts,
    text
  });
}

function auditPayload() {
  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    sitemapUrl,
    sitemapArticleCount: allEntries.length,
    requestedArticleCount: entries.length,
    completedArticleCount: completed,
    candidateCount: candidates.length,
    failureCount: failures.length,
    failures: [...failures].sort((left, right) => left.url.localeCompare(right.url)),
    candidates: [...candidates].sort((left, right) => left.url.localeCompare(right.url))
  };
}

async function worker() {
  while (true) {
    const index = nextIndex;
    nextIndex += 1;
    if (index >= entries.length) return;
    const entry = entries[index];

    try {
      const html = await fetchText(entry.url);
      auditDocument(entry, html);
    } catch (error) {
      failures.push({ url: entry.url, error: error instanceof Error ? error.message : String(error) });
    }

    completed += 1;
    if (completed % 100 === 0 || completed === entries.length) {
      process.stdout.write(
        `Audited ${completed}/${entries.length}; candidates=${candidates.length}; failures=${failures.length}\n`
      );
    }
    if (completed % checkpointEvery === 0) await atomicWriteJson(outputPath, auditPayload());
    await sleep(delayMs);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, () => worker()));
await atomicWriteJson(outputPath, auditPayload());

if (failures.length) {
  process.stderr.write(`Completed with ${failures.length} failed URL(s). See ${outputPath}.\n`);
  process.exitCode = 2;
} else {
  process.stdout.write(`Complete audit written to ${outputPath}.\n`);
}

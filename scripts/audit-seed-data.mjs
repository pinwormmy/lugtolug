import { readFile } from "node:fs/promises";
import seed from "../data/watches.seed.json" with { type: "json" };
import { compactReference, getWatchSlugs } from "../src/lib/watchText.ts";
import { renderSeedSql } from "./lib/seed-sql.mjs";

const REQUIRED_TEXT_FIELDS = ["brand", "model", "reference"];
const OPTIONAL_TEXT_FIELDS = ["canonicalModel", "modelGroup", "variant"];
const METRIC_LIMITS = {
  lugToLugMm: 100,
  caseMm: 100,
  thicknessMm: 50,
  lugWidthMm: 50
};
const HTML_ENTITY_PATTERN = /&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f\ufffd]/u;

const issues = [];
const seenIds = new Map();
const seenRouteKeys = new Map();
const seenProductIdentities = new Map();
const brands = new Set();
let sourceCount = 0;

function addIssue(watchId, message) {
  issues.push(`${watchId == null ? "seed" : `watch ${watchId}`}: ${message}`);
}

function checkCleanText(watchId, field, value, { required = false } = {}) {
  if (value == null) {
    if (required) addIssue(watchId, `${field} is required.`);
    return;
  }
  if (typeof value !== "string") {
    addIssue(watchId, `${field} must be a string.`);
    return;
  }
  if (required && value.length === 0) addIssue(watchId, `${field} is required.`);
  if (!required && value.length === 0) addIssue(watchId, `${field} must be omitted instead of empty.`);
  if (value !== value.trim()) addIssue(watchId, `${field} has leading or trailing whitespace.`);
  if (CONTROL_CHARACTER_PATTERN.test(value)) addIssue(watchId, `${field} contains a control or replacement character.`);
  if (HTML_ENTITY_PATTERN.test(value)) addIssue(watchId, `${field} contains an encoded HTML entity.`);
}

function registerUnique(map, key, watchId, label) {
  const existingId = map.get(key);
  if (existingId != null) {
    addIssue(watchId, `${label} duplicates watch ${existingId}: ${key}`);
  } else {
    map.set(key, watchId);
  }
}

for (const [index, watch] of seed.entries()) {
  if (!Number.isSafeInteger(watch.id) || watch.id < 1) {
    addIssue(watch.id, "id must be a positive safe integer.");
  } else {
    registerUnique(seenIds, watch.id, watch.id, "id");
  }
  if (index > 0 && watch.id <= seed[index - 1].id) {
    addIssue(watch.id, `records must be ordered by ascending id after ${seed[index - 1].id}.`);
  }

  for (const field of REQUIRED_TEXT_FIELDS) checkCleanText(watch.id, field, watch[field], { required: true });
  for (const field of OPTIONAL_TEXT_FIELDS) checkCleanText(watch.id, field, watch[field]);
  brands.add(watch.brand);

  if (Boolean(watch.canonicalModel) !== Boolean(watch.modelGroup)) {
    addIssue(watch.id, "canonicalModel and modelGroup must be defined together.");
  }
  if (watch.variant && (!watch.canonicalModel || !watch.modelGroup)) {
    addIssue(watch.id, "variant requires canonicalModel and modelGroup.");
  }

  for (const [field, maximum] of Object.entries(METRIC_LIMITS)) {
    const value = watch[field];
    const required = field === "lugToLugMm";
    if (value == null && !required) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) {
      addIssue(watch.id, `${field} must be a finite number greater than 0 and no more than ${maximum}.`);
    }
  }

  const slugs = getWatchSlugs(watch);
  const routeKey = `${slugs.brandSlug}/${slugs.modelSlug}/${slugs.referenceSlug}`;
  registerUnique(seenRouteKeys, routeKey, watch.id, "route");

  const compact = compactReference(watch.reference);
  if (compact.length >= 3 && /\d/u.test(compact)) {
    registerUnique(seenProductIdentities, `${slugs.brandSlug}|${compact}`, watch.id, "product identity");
  }

  if (!Array.isArray(watch.sources) || watch.sources.length === 0) {
    addIssue(watch.id, "at least one source is required.");
    continue;
  }

  const seenSources = new Map();
  for (const source of watch.sources) {
    sourceCount += 1;
    checkCleanText(watch.id, "sourceUrl", source.sourceUrl, { required: true });
    if (source.note != null) checkCleanText(watch.id, "source note", source.note);

    try {
      const url = new URL(source.sourceUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        addIssue(watch.id, `source URL must use HTTP(S): ${source.sourceUrl}`);
      }
      const sourceKey = url.href.replace(/\/$/u, "");
      registerUnique(seenSources, sourceKey, watch.id, "source URL");
    } catch {
      addIssue(watch.id, `source URL is invalid: ${source.sourceUrl}`);
    }
  }
}

const committedSeedSql = await readFile(new URL("../data/seed.sql", import.meta.url), "utf8");
if (committedSeedSql !== renderSeedSql(seed)) {
  addIssue(null, "data/seed.sql is stale; run npm run data:seed-sql.");
}

if (issues.length > 0) {
  process.stderr.write(`Seed data audit failed with ${issues.length} issue(s):\n`);
  for (const issue of issues.slice(0, 50)) process.stderr.write(`- ${issue}\n`);
  if (issues.length > 50) process.stderr.write(`- …and ${issues.length - 50} more.\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Seed data audit passed: ${seed.length} watches, ${brands.size} brands, ${sourceCount} sources, no identity or route collisions.\n`
  );
}

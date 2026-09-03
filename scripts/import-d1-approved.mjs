// Fold approved D1 records into data/watches.seed.json so public pages never
// depend on D1 for them (the seed is the complete public catalog; D1 holds
// operator approvals and edits until they land here). Two cases:
//   - a D1 row whose id is not in the seed is appended (with its D1 id)
//   - a D1 row whose id is in the seed but whose fields differ is an operator
//     edit made in the admin UI; the seed entry is updated from D1
//
//   node scripts/import-d1-approved.mjs            # report only
//   node scripts/import-d1-approved.mjs --write    # append to the seed
//   --input=rows.json   use {"watches":[...],"sources":[...]} instead of querying D1
//   --seed=path         seed file to read/write (default data/watches.seed.json)
//
// Without --input the script queries production D1 through wrangler: one
// approved-watches scan (~7.4k rows against the daily read quota) plus one
// indexed watch_sources lookup. Seed ids reuse the D1 ids because
// data/seed.sql upserts ON CONFLICT(id). Afterwards run `npm run data:audit`
// and `npm run data:seed-sql`.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getWatchSlugs } from "../src/lib/watchText.ts";

const DATABASE = "lugtolug-finder";
const MAX_NAME_LENGTH = 90;

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const shouldWrite = process.argv.includes("--write");
const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const inputPath = argumentValue("input");

function d1Query(sql) {
  const output = execFileSync("npx", ["wrangler", "d1", "execute", DATABASE, "--remote", "--json", "--command", sql], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
  const start = output.indexOf("[");
  if (start === -1) throw new Error(`Unexpected wrangler output:\n${output}`);
  const [result] = JSON.parse(output.slice(start));
  if (!result?.success) throw new Error(`D1 query failed:\n${output}`);
  return result.results;
}

function watchKey(slugs) {
  return `${slugs.brandSlug}/${slugs.modelSlug}/${slugs.referenceSlug}`;
}

function loadRows() {
  if (inputPath) {
    const parsed = JSON.parse(readFileSync(resolve(inputPath), "utf8"));
    return { watches: parsed.watches ?? [], sources: parsed.sources ?? [] };
  }

  const watches = d1Query(
    "SELECT id, brand, model, canonical_model, model_group, variant, reference, brand_slug, model_slug, reference_slug, " +
      "lug_to_lug_mm, case_mm, thickness_mm, lug_width_mm FROM watches WHERE status = 'approved'"
  );
  return { watches, sources: null };
}

function loadSources(rows, ids) {
  if (rows) return rows.filter((source) => ids.includes(source.watch_id));
  if (ids.length === 0) return [];
  return d1Query(`SELECT watch_id, source_url, note FROM watch_sources WHERE watch_id IN (${ids.join(",")}) ORDER BY id`);
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toSeedEntry(row, sources, problems) {
  const brand = cleanText(row.brand);
  const model = cleanText(row.model);
  const reference = cleanText(row.reference);
  if (!brand || !model || !reference) problems.push("missing brand, model, or reference");
  if ((model?.length ?? 0) > MAX_NAME_LENGTH) problems.push(`model longer than ${MAX_NAME_LENGTH} characters`);
  if ((reference?.length ?? 0) > MAX_NAME_LENGTH) problems.push(`reference longer than ${MAX_NAME_LENGTH} characters`);

  const lugToLugMm = numberOrNull(row.lug_to_lug_mm);
  if (lugToLugMm == null || lugToLugMm <= 0) problems.push("missing lug-to-lug");

  const seedSources = sources
    .map((source) => ({ sourceUrl: cleanText(source.source_url), note: cleanText(source.note) }))
    .filter((source) => {
      if (!source.sourceUrl) return false;
      try {
        new URL(source.sourceUrl);
        return true;
      } catch {
        return false;
      }
    })
    .map((source) => (source.note ? source : { sourceUrl: source.sourceUrl }));
  if (seedSources.length === 0) problems.push("no valid source URL");

  // canonicalModel and modelGroup travel as a pair; a variant needs both.
  let canonicalModel = cleanText(row.canonical_model);
  let modelGroup = cleanText(row.model_group);
  let variant = cleanText(row.variant);
  if (Boolean(canonicalModel) !== Boolean(modelGroup)) {
    problems.push(`dropping unpaired canonicalModel/modelGroup (${canonicalModel ?? "-"} / ${modelGroup ?? "-"})`);
    canonicalModel = null;
    modelGroup = null;
  }
  if (variant && !(canonicalModel && modelGroup)) {
    problems.push(`dropping variant "${variant}" without a model group`);
    variant = null;
  }

  return {
    id: row.id,
    brand,
    model,
    ...(canonicalModel ? { canonicalModel } : {}),
    ...(modelGroup ? { modelGroup } : {}),
    ...(variant ? { variant } : {}),
    reference,
    lugToLugMm,
    caseMm: numberOrNull(row.case_mm),
    thicknessMm: numberOrNull(row.thickness_mm),
    lugWidthMm: numberOrNull(row.lug_width_mm),
    sources: seedSources
  };
}

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const seedById = new Map(seed.map((watch) => [watch.id, watch]));
const seedKeys = new Set(seed.map((watch) => watchKey(getWatchSlugs(watch))));

const COMPARED_FIELDS = ["brand", "model", "canonicalModel", "modelGroup", "variant", "reference", "lugToLugMm", "caseMm", "thicknessMm", "lugWidthMm"];

function fieldDiff(current, next) {
  return COMPARED_FIELDS.filter((field) => (current[field] ?? null) !== (next[field] ?? null)).map(
    (field) => `${field}: ${JSON.stringify(current[field] ?? null)} -> ${JSON.stringify(next[field] ?? null)}`
  );
}

const { watches, sources: providedSources } = loadRows();
const candidates = watches.filter((row) => {
  const existing = seedById.get(row.id);
  if (existing) return true; // reconcile below; cheap to compare
  const key = `${row.brand_slug}/${row.model_slug}/${row.reference_slug}`;
  const computed = watchKey(getWatchSlugs({ brand: row.brand ?? "", model: row.model ?? "", reference: row.reference ?? "" }));
  return !seedKeys.has(key) && !seedKeys.has(computed);
});

// Only rows that are new or differ from the seed need their sources fetched.
const changed = candidates.filter((row) => {
  const existing = seedById.get(row.id);
  if (!existing) return true;
  const probe = toSeedEntry(row, [{ source_url: "https://placeholder.invalid/" }], []);
  return fieldDiff(existing, probe).length > 0;
});
console.log(`Approved in D1: ${watches.length}. New: ${changed.filter((row) => !seedById.has(row.id)).length}. Edited in D1: ${changed.filter((row) => seedById.has(row.id)).length}.`);

const sourceRows = loadSources(providedSources, changed.map((row) => row.id));
const added = [];
const updated = [];
const skipped = [];
for (const row of changed) {
  const problems = [];
  const existing = seedById.get(row.id);
  const rowSources = sourceRows.filter((source) => source.watch_id === row.id);
  const entry = toSeedEntry(row, rowSources, problems);
  if (existing) {
    // Keep every source the seed already cites; D1 may hold a subset.
    const seen = new Set(entry.sources.map((source) => source.sourceUrl));
    for (const source of existing.sources ?? []) {
      if (!seen.has(source.sourceUrl)) entry.sources.push(source);
    }
    problems.splice(0, problems.length, ...problems.filter((problem) => problem !== "no valid source URL" || entry.sources.length === 0));
  }
  const fatal = problems.filter((problem) => !problem.startsWith("dropping"));
  if (fatal.length > 0) {
    skipped.push({ row, problems });
    continue;
  }
  if (problems.length > 0) console.log(`  note ${row.id} ${row.brand} ${row.model}: ${problems.join("; ")}`);
  if (existing) updated.push({ existing, entry, diff: fieldDiff(existing, entry) });
  else added.push(entry);
}

for (const entry of added) {
  console.log(`  + ${entry.id} ${entry.brand} ${entry.model} ${entry.reference} (L2L ${entry.lugToLugMm}, ${entry.sources.length} source${entry.sources.length === 1 ? "" : "s"})`);
}
for (const { entry, diff } of updated) {
  console.log(`  ~ ${entry.id} ${entry.brand} ${entry.model} ${entry.reference}: ${diff.join("; ")}`);
}
for (const { row, problems } of skipped) {
  console.log(`  ! skipped ${row.id} ${row.brand} ${row.model} ${row.reference}: ${problems.join("; ")}`);
}

if (!shouldWrite) {
  console.log(added.length + updated.length > 0 ? "Dry run; pass --write to apply these to the seed." : "Nothing to change.");
  process.exit(0);
}

if (added.length + updated.length === 0) {
  console.log("Nothing to write.");
  process.exit(0);
}

const updatedById = new Map(updated.map(({ entry }) => [entry.id, entry]));
const merged = [...seed.map((watch) => updatedById.get(watch.id) ?? watch), ...added].sort((a, b) => a.id - b.id);
writeFileSync(seedPath, `${JSON.stringify(merged, null, 2)}\n`);
console.log(`Wrote ${added.length} new and ${updated.length} updated record(s) to ${seedPath}. Now run npm run data:audit && npm run data:seed-sql.`);

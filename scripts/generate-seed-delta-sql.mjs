import { execFileSync } from "node:child_process";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import seed from "../data/watches.seed.json" with { type: "json" };
import brandSearchAliases from "../data/brand-search-aliases.json" with { type: "json" };
import { buildWatchSearchText, getWatchModelSlug, slugify } from "../src/lib/watchText.ts";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function positiveIntegerArgument(name, fallback) {
  const value = Number(argumentValue(name) ?? fallback);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`--${name} must be a positive integer.`);
  return value;
}

const baseRef = argumentValue("base-ref") ?? "HEAD^";
const outputDir = resolve(argumentValue("output-dir") ?? "/private/tmp/lugtolug-seed-delta");
const watchBatchSize = positiveIntegerArgument("watch-batch-size", 50);
const sourceBatchSize = positiveIntegerArgument("source-batch-size", 100);

const baseSeed = JSON.parse(
  execFileSync("git", ["show", `${baseRef}:data/watches.seed.json`], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024
  })
);

const WATCH_COLUMNS = [
  "id",
  "brand",
  "model",
  "canonical_model",
  "model_group",
  "variant",
  "reference",
  "brand_slug",
  "model_slug",
  "reference_slug",
  "search_text",
  "lug_to_lug_mm",
  "case_mm",
  "thickness_mm",
  "lug_width_mm",
  "status"
];

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function sqlValue(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function watchRow(watch) {
  return [
    watch.id,
    watch.brand,
    watch.model,
    optionalString(watch.canonicalModel),
    optionalString(watch.modelGroup),
    optionalString(watch.variant),
    watch.reference,
    slugify(watch.brand),
    getWatchModelSlug(watch),
    slugify(watch.reference),
    buildWatchSearchText(watch, brandSearchAliases),
    watch.lugToLugMm,
    watch.caseMm,
    watch.thicknessMm,
    watch.lugWidthMm,
    "approved"
  ].map(sqlValue);
}

function watchWithoutSources(watch) {
  const { sources: _sources, ...value } = watch;
  return value;
}

function chunks(values, size) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );
}

const baseById = new Map(baseSeed.map((watch) => [watch.id, watch]));
const changedWatches = seed.filter((watch) => {
  const baseWatch = baseById.get(watch.id);
  return !baseWatch || JSON.stringify(watchWithoutSources(baseWatch)) !== JSON.stringify(watchWithoutSources(watch));
});

const changedSources = [];
for (const watch of seed) {
  const baseSources = new Map((baseById.get(watch.id)?.sources ?? []).map((source) => [source.sourceUrl, source.note ?? null]));
  for (const source of watch.sources) {
    if (!baseSources.has(source.sourceUrl) || baseSources.get(source.sourceUrl) !== (source.note ?? null)) {
      changedSources.push({ watchId: watch.id, sourceUrl: source.sourceUrl, note: source.note ?? null });
    }
  }
}

await mkdir(outputDir, { recursive: true });
for (const filename of await readdir(outputDir)) {
  if (/^(?:watch|source)-\d+\.sql$/u.test(filename) || filename === "manifest.json") {
    await unlink(resolve(outputDir, filename));
  }
}

const updateColumns = WATCH_COLUMNS.filter((column) => !["id", "status"].includes(column));
const files = [];

for (const [index, batch] of chunks(changedWatches, watchBatchSize).entries()) {
  const filename = `watch-${String(index + 1).padStart(3, "0")}.sql`;
  const sql = [
    `-- Seed watch delta from ${baseRef}; chunk ${index + 1}.`,
    `UPDATE watches SET reference_slug = 'seed-tmp-' || id WHERE id IN (${batch.map((watch) => watch.id).join(", ")});`,
    "INSERT INTO watches",
    `(${WATCH_COLUMNS.join(", ")})`,
    "VALUES",
    batch.map((watch) => `(${watchRow(watch).join(", ")})`).join(",\n"),
    "ON CONFLICT(id) DO UPDATE SET",
    [
      ...updateColumns.map((column) => `  ${column} = excluded.${column}`),
      "  status = CASE WHEN watches.status = 'approved' THEN excluded.status ELSE watches.status END",
      "  updated_at = CURRENT_TIMESTAMP"
    ].join(",\n") + ";",
    ""
  ].join("\n");
  await writeFile(resolve(outputDir, filename), sql);
  files.push(filename);
}

for (const [index, batch] of chunks(changedSources, sourceBatchSize).entries()) {
  const filename = `source-${String(index + 1).padStart(3, "0")}.sql`;
  const statements = batch.flatMap((source) => {
    const watchId = sqlValue(source.watchId);
    const sourceUrl = sqlValue(source.sourceUrl);
    const note = sqlValue(source.note);
    return [
      `UPDATE watch_sources SET note = ${note} WHERE watch_id = ${watchId} AND source_url = ${sourceUrl};`,
      [
        "INSERT INTO watch_sources (watch_id, source_url, note)",
        `SELECT ${watchId}, ${sourceUrl}, ${note}`,
        `WHERE NOT EXISTS (SELECT 1 FROM watch_sources WHERE watch_id = ${watchId} AND source_url = ${sourceUrl});`
      ].join("\n")
    ];
  });
  await writeFile(
    resolve(outputDir, filename),
    [`-- Seed source delta from ${baseRef}; chunk ${index + 1}.`, ...statements, ""].join("\n")
  );
  files.push(filename);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  baseRef,
  changedWatchCount: changedWatches.length,
  changedSourceCount: changedSources.length,
  watchBatchSize,
  sourceBatchSize,
  files
};
await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `Generated ${files.length} delta SQL chunks in ${outputDir}: ` +
    `${changedWatches.length} watches and ${changedSources.length} sources.\n`
);

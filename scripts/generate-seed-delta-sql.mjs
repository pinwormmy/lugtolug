import { execFileSync } from "node:child_process";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import seed from "../data/watches.seed.json" with { type: "json" };
import {
  chunkValues,
  renderSourceUpsertStatements,
  renderWatchUpsertStatement,
  sqlValue,
  watchWithoutSources
} from "./lib/seed-sql.mjs";

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
  if (/^(?:retired|watch|source|source-delete)-\d+\.sql$/u.test(filename) || filename === "manifest.json") {
    await unlink(resolve(outputDir, filename));
  }
}

const files = [];
const seedIds = new Set(seed.map((watch) => watch.id));
const retiredWatches = baseSeed.filter((watch) => !seedIds.has(watch.id));
const currentById = new Map(seed.map((watch) => [watch.id, watch]));
const removedSources = [];

for (const baseWatch of baseSeed) {
  const currentSources = new Set((currentById.get(baseWatch.id)?.sources ?? []).map((source) => source.sourceUrl));
  for (const source of baseWatch.sources) {
    if (!currentSources.has(source.sourceUrl)) {
      removedSources.push({ watchId: baseWatch.id, sourceUrl: source.sourceUrl });
    }
  }
}

for (const [index, batch] of chunkValues(retiredWatches, watchBatchSize).entries()) {
  const filename = `retired-${String(index + 1).padStart(3, "0")}.sql`;
  const sql = [
    `-- Retired seed watches removed since ${baseRef}; chunk ${index + 1}.`,
    `UPDATE watches SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id IN (${batch.map((watch) => watch.id).join(", ")}) AND status = 'approved';`,
    ""
  ].join("\n");
  await writeFile(resolve(outputDir, filename), sql);
  files.push(filename);
}

for (const [index, batch] of chunkValues(removedSources, sourceBatchSize).entries()) {
  const filename = `source-delete-${String(index + 1).padStart(3, "0")}.sql`;
  const statements = batch.map(
    (source) =>
      `DELETE FROM watch_sources WHERE watch_id = ${sqlValue(source.watchId)} AND source_url = ${sqlValue(source.sourceUrl)};`
  );
  await writeFile(
    resolve(outputDir, filename),
    [`-- Seed source removals since ${baseRef}; chunk ${index + 1}.`, ...statements, ""].join("\n")
  );
  files.push(filename);
}

for (const [index, batch] of chunkValues(changedWatches, watchBatchSize).entries()) {
  const filename = `watch-${String(index + 1).padStart(3, "0")}.sql`;
  const sql = [
    `-- Seed watch delta from ${baseRef}; chunk ${index + 1}.`,
    `UPDATE watches SET reference_slug = 'seed-tmp-' || id WHERE id IN (${batch.map((watch) => watch.id).join(", ")});`,
    renderWatchUpsertStatement(batch),
    ""
  ].join("\n");
  await writeFile(resolve(outputDir, filename), sql);
  files.push(filename);
}

for (const [index, batch] of chunkValues(changedSources, sourceBatchSize).entries()) {
  const filename = `source-${String(index + 1).padStart(3, "0")}.sql`;
  const statements = batch.flatMap(renderSourceUpsertStatements);
  await writeFile(
    resolve(outputDir, filename),
    [`-- Seed source delta from ${baseRef}; chunk ${index + 1}.`, ...statements, ""].join("\n")
  );
  files.push(filename);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  baseRef,
  retiredWatchCount: retiredWatches.length,
  changedWatchCount: changedWatches.length,
  removedSourceCount: removedSources.length,
  changedSourceCount: changedSources.length,
  watchBatchSize,
  sourceBatchSize,
  files
};
await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
process.stdout.write(
  `Generated ${files.length} delta SQL chunks in ${outputDir}: ` +
    `${retiredWatches.length} retired watches, ${changedWatches.length} changed watches, ` +
    `${removedSources.length} removed sources, and ${changedSources.length} changed sources.\n`
);

// Bring production D1 in line with the repository after a deploy, in the order
// the data pipeline expects:
//   1. apply pending migrations
//   2. upsert the seed rows changed since --base-ref as small delta chunks
//      (the full 12 MB seed exceeds D1's import limits and is rolled back)
//   3. move any remaining rows to the current slug rule (rows the seed does not
//      carry: operator approvals, archived duplicates)
//
//   npm run db:sync:remote -- --base-ref=<commit deployed before this one>
//   npm run db:sync:remote -- --base-ref=b144f8a --dry-run   # print the plan only
//
// Needs `wrangler login` or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DATABASE = "lugtolug-finder";
const RESLUG_BATCH_SIZE = 100;

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const baseRef = argumentValue("base-ref");
if (!baseRef) {
  console.error("Usage: npm run db:sync:remote -- --base-ref=<commit deployed before this one> [--dry-run]");
  process.exit(1);
}
const dryRun = process.argv.includes("--dry-run");
const outputDir = resolve(argumentValue("output-dir") ?? ".wrangler/remote-sync");
mkdirSync(outputDir, { recursive: true });

function run(command, args, { capture = false } = {}) {
  console.log(`$ ${command} ${args.join(" ")}`);
  if (dryRun && command === "npx") return "";
  return execFileSync(command, args, { encoding: "utf8", stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", maxBuffer: 64 * 1024 * 1024 });
}

function executeRemote(file) {
  run("npx", ["wrangler", "d1", "execute", DATABASE, "--remote", "--yes", `--file=${file}`]);
}

// 1. migrations
run("npx", ["wrangler", "d1", "migrations", "apply", DATABASE, "--remote"]);

// 2. seed delta chunks
const deltaDir = resolve(outputDir, "seed-delta");
run("node", ["scripts/generate-seed-delta-sql.mjs", `--base-ref=${baseRef}`, `--output-dir=${deltaDir}`]);
const manifest = JSON.parse(readFileSync(resolve(deltaDir, "manifest.json"), "utf8"));
console.log(
  `Delta since ${baseRef}: ${manifest.changedWatchCount} changed watches, ${manifest.retiredWatchCount} retired, ` +
    `${manifest.changedSourceCount} changed sources, ${manifest.removedSourceCount} removed sources in ${manifest.files.length} chunk(s).`
);
for (const file of manifest.files) executeRemote(resolve(deltaDir, file));

// 3. remaining rows on old slugs
const reslugSql = dryRun ? "" : run("node", ["scripts/generate-reslug-sql.mjs"], { capture: true });
const statements = reslugSql.split("\n").filter((line) => line.startsWith("UPDATE "));
console.log(`${statements.length} row(s) still on old slugs after the delta.`);
for (let index = 0; index * RESLUG_BATCH_SIZE < statements.length; index += 1) {
  const file = resolve(outputDir, `reslug-${String(index + 1).padStart(3, "0")}.sql`);
  writeFileSync(file, `${statements.slice(index * RESLUG_BATCH_SIZE, (index + 1) * RESLUG_BATCH_SIZE).join("\n")}\n`);
  executeRemote(file);
}

console.log(dryRun ? "Dry run complete; nothing was sent to D1." : "Production D1 is in sync.");

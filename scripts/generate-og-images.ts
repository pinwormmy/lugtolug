// Renders one Open Graph PNG per seed watch and per brand (plus a site-wide
// default) into public/og/, so social previews carry the dimensions without any
// runtime rendering or D1 reads. Run by src/integrations/ogImages.ts before
// `astro build`, or by hand with `npm run og:generate`. The output directory is
// gitignored; a stamp file skips regeneration while the seed and template are
// unchanged.
//
// PNG encoding dominates the cost (~8 ms of ~11 ms per card) and runs on the
// calling thread, so the work is split across child processes, one per core.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { seedWatches } from "@/lib/seed";
import {
  OG_TEMPLATE_VERSION,
  OG_WIDTH,
  renderBrandOgSvg,
  renderDefaultOgSvg,
  renderWatchOgSvg,
  type OgBrandSummary
} from "@/lib/ogCard";
import { DEFAULT_OG_IMAGE_PATH, getBrandOgImagePath, getWatchOgImagePath } from "@/lib/ogImage";

const STAMP_FILE = ".stamp";
const MAX_SHARDS = 8;

const require = createRequire(import.meta.url);
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const TSX_CLI = require.resolve("tsx/cli");
const TSCONFIG = fileURLToPath(new URL("../tsconfig.json", import.meta.url));
const SEED_FILE = fileURLToPath(new URL("../data/watches.seed.json", import.meta.url));
const fontDirectory = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const FONT_FILES = [path.join(fontDirectory, "DejaVuSans.ttf"), path.join(fontDirectory, "DejaVuSans-Bold.ttf")];

function renderPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_WIDTH },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "DejaVu Sans" }
  });
  return resvg.render().asPng();
}

type BrandSummaryWithSlug = OgBrandSummary & { slug: string };

function summarizeBrands(): BrandSummaryWithSlug[] {
  const byBrand = new Map<string, BrandSummaryWithSlug>();
  const extend = (current: number | null, value: number | null | undefined, pick: (a: number, b: number) => number) =>
    value == null ? current : current == null ? value : pick(current, value);

  for (const watch of seedWatches) {
    const summary = byBrand.get(watch.brandSlug) ?? {
      slug: watch.brandSlug,
      brand: watch.brand,
      count: 0,
      lugToLugMinMm: watch.lugToLugMm,
      lugToLugMaxMm: watch.lugToLugMm,
      caseMinMm: null,
      caseMaxMm: null,
      thicknessMinMm: null,
      thicknessMaxMm: null
    };
    summary.count += 1;
    summary.lugToLugMinMm = Math.min(summary.lugToLugMinMm, watch.lugToLugMm);
    summary.lugToLugMaxMm = Math.max(summary.lugToLugMaxMm, watch.lugToLugMm);
    summary.caseMinMm = extend(summary.caseMinMm, watch.caseMm, Math.min);
    summary.caseMaxMm = extend(summary.caseMaxMm, watch.caseMm, Math.max);
    summary.thicknessMinMm = extend(summary.thicknessMinMm, watch.thicknessMm, Math.min);
    summary.thicknessMaxMm = extend(summary.thicknessMaxMm, watch.thicknessMm, Math.max);
    byBrand.set(watch.brandSlug, summary);
  }
  return [...byBrand.values()];
}

async function currentStamp(): Promise<string> {
  const hash = createHash("sha256");
  hash.update(OG_TEMPLATE_VERSION);
  hash.update(await readFile(SEED_FILE));
  return hash.digest("hex");
}

/** Render every card whose index falls in this shard. Shard 0 also renders the brand and default cards. */
async function renderShard(publicDir: string, shard: number, shardCount: number): Promise<number> {
  const ensuredDirectories = new Set<string>();
  const write = async (publicPath: string, svg: string) => {
    const filePath = path.join(publicDir, publicPath);
    const directory = path.dirname(filePath);
    if (!ensuredDirectories.has(directory)) {
      await mkdir(directory, { recursive: true });
      ensuredDirectories.add(directory);
    }
    await writeFile(filePath, renderPng(svg));
  };

  if (shard === 0) {
    await write(DEFAULT_OG_IMAGE_PATH, renderDefaultOgSvg(seedWatches.length));
    for (const summary of summarizeBrands()) {
      await write(getBrandOgImagePath(summary.slug), renderBrandOgSvg(summary));
    }
  }

  let rendered = 0;
  for (let index = shard; index < seedWatches.length; index += shardCount) {
    await write(getWatchOgImagePath(seedWatches[index]), renderWatchOgSvg(seedWatches[index]));
    rendered += 1;
  }
  return rendered;
}

function runShard(publicDir: string, shard: number, shardCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [TSX_CLI, "--tsconfig", TSCONFIG, SCRIPT_FILE, publicDir, "--shard", `${shard}/${shardCount}`],
      { stdio: "inherit" }
    );
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Open Graph card shard ${shard}/${shardCount} failed (exit code ${code}).`));
    });
  });
}

export async function generateOgImages(publicDir: string, log: (message: string) => void = console.log): Promise<void> {
  const outputDir = path.join(publicDir, "og");
  const stampPath = path.join(outputDir, STAMP_FILE);
  const stamp = await currentStamp();
  const existingStamp = await readFile(stampPath, "utf8").catch(() => null);
  if (existingStamp === stamp) {
    log("Open Graph cards are up to date; skipping generation.");
    return;
  }

  const startedAt = Date.now();
  const shardCount = Math.max(1, Math.min(MAX_SHARDS, os.availableParallelism()));
  log(`Rendering Open Graph cards for ${seedWatches.length} watches across ${shardCount} processes…`);
  await mkdir(outputDir, { recursive: true });
  await Promise.all(Array.from({ length: shardCount }, (_, shard) => runShard(publicDir, shard, shardCount)));

  await writeFile(stampPath, stamp);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`Rendered ${seedWatches.length} watch cards, brand cards and the default card in ${seconds}s.`);
}

const invokedDirectly = process.argv[1] !== undefined && path.resolve(process.argv[1]) === SCRIPT_FILE;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const shardArgument = args[args.indexOf("--shard") + 1];
  const publicDir = path.resolve(args.find((arg) => !arg.startsWith("--") && arg !== shardArgument) ?? "public");
  const task =
    args.includes("--shard") && shardArgument
      ? renderShard(publicDir, Number(shardArgument.split("/")[0]), Number(shardArgument.split("/")[1])).then(() => undefined)
      : generateOgImages(publicDir);
  task.catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

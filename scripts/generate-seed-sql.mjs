import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import seed from "../data/watches.seed.json" with { type: "json" };
import { renderSeedSql } from "./lib/seed-sql.mjs";

const brandArg = process.argv.find((argument) => argument.startsWith("--brand="));
const outputArg = process.argv.find((argument) => argument.startsWith("--output="));
const selectedBrand = brandArg?.slice("--brand=".length).trim() || null;
const outputPath = outputArg
  ? resolve(process.cwd(), outputArg.slice("--output=".length))
  : fileURLToPath(new URL("../data/seed.sql", import.meta.url));

writeFileSync(outputPath, renderSeedSql(seed, { selectedBrand }));

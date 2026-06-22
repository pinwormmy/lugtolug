import seed from "../data/watches.seed.json" with { type: "json" };

const DEFAULT_BRANDS = new Set(["tissot", "citizen", "seiko"]);
const EXACT_ONLY = process.argv.includes("--exact");

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(mm|automatic|auto|powermatic|mechanical|watch|date|dial|bracelet|strap)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactReference(reference) {
  return String(reference).replace(/[^a-z0-9]+/gi, "").toUpperCase();
}

function dimensionKey(watch) {
  return [watch.lugToLugMm, watch.caseMm, watch.thicknessMm, watch.lugWidthMm]
    .map((value) => (value == null ? "null" : Number(value).toFixed(1)))
    .join("|");
}

function referenceFamily(reference) {
  const compact = compactReference(reference);
  return compact.slice(0, Math.min(7, compact.length));
}

function tokenSet(value) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function jaccard(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function selectedBrands() {
  if (process.argv.includes("--all")) return null;
  const brandArg = process.argv.find((arg) => arg.startsWith("--brands="));
  if (!brandArg) return DEFAULT_BRANDS;
  return new Set(
    brandArg
      .slice("--brands=".length)
      .split(",")
      .map((brand) => normalize(brand).replace(/\s+/g, "-"))
      .filter(Boolean)
  );
}

const brands = selectedBrands();
const scopedSeed = seed.filter((watch) => {
  const brandKey = normalize(watch.brand).replace(/\s+/g, "-");
  return !brands || brands.has(brandKey);
});

function exactDuplicateGroups() {
  const groups = new Map();

  for (const watch of scopedSeed) {
    const reference = compactReference(watch.reference);
    if (!reference) continue;

    const key = [reference, dimensionKey(watch)].join("|");
    const current = groups.get(key) ?? [];
    current.push(watch);
    groups.set(key, current);
  }

  return [...groups.values()].filter((group) => group.length > 1);
}

function formatWatch(watch) {
  const display = watch.canonicalModel ? `${watch.model} -> ${watch.canonicalModel}` : watch.model;
  const group = watch.modelGroup ? `; modelGroup=${watch.modelGroup}` : "";
  const variant = watch.variant ? `; variant=${watch.variant}` : "";
  return `- id=${watch.id}; ${watch.brand}; ${watch.reference}: ${display}${group}${variant}`;
}

const exactGroups = exactDuplicateGroups();
const exactKeys = new Set(
  exactGroups.map((group) => {
    const [first] = group;
    return [compactReference(first.reference), dimensionKey(first)].join("|");
  })
);

console.log("# Watch Duplicate Candidate Report");
console.log("");
console.log(`Scope: ${brands ? [...brands].join(", ") : "all brands"}`);
console.log(`Exact compact reference + dimension duplicate groups: ${exactGroups.length}`);

for (const group of exactGroups) {
  const [first] = group;
  console.log("");
  console.log(`## exact: ref ${compactReference(first.reference)}, dimensions ${dimensionKey(first)}`);
  for (const watch of group) console.log(formatWatch(watch));
}

if (EXACT_ONLY) process.exit(0);

const groups = new Map();

for (const watch of scopedSeed) {
  const brandKey = normalize(watch.brand).replace(/\s+/g, "-");

  const key = [brandKey, dimensionKey(watch), referenceFamily(watch.reference)].join("|");
  const current = groups.get(key) ?? [];
  current.push(watch);
  groups.set(key, current);
}

const candidates = [...groups.values()]
  .filter((group) => group.length > 1)
  .map((group) => {
    const pairs = [];
    for (let index = 0; index < group.length; index += 1) {
      for (let compare = index + 1; compare < group.length; compare += 1) {
        pairs.push(jaccard(group[index].canonicalModel ?? group[index].model, group[compare].canonicalModel ?? group[compare].model));
      }
    }
    const score = pairs.length ? Math.max(...pairs) : 0;
    return {
      status: score >= 0.45 ? "candidate" : "needs review",
      score,
      group
    };
  })
  .filter((candidate) => {
    const [first] = candidate.group;
    return !exactKeys.has([compactReference(first.reference), dimensionKey(first)].join("|"));
  })
  .sort((left, right) => left.group[0].brand.localeCompare(right.group[0].brand) || right.score - left.score);

console.log(`Candidate groups: ${candidates.length}`);
console.log("");

for (const candidate of candidates) {
  const [first] = candidate.group;
  console.log(`## ${candidate.status}: ${first.brand} ${first.caseMm ?? "?"}mm case, ref family ${referenceFamily(first.reference)}`);
  console.log(`Similarity: ${candidate.score.toFixed(2)}`);
  for (const watch of candidate.group) {
    console.log(formatWatch(watch));
  }
  console.log("");
}

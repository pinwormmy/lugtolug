import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { slugify } from "../src/lib/watchText.ts";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const reportPath = resolve(argumentValue("report") ?? "/private/tmp/brand-name-normalization.json");
const apply = process.argv.includes("--apply");

// One brand had been stored under several spellings, so its records were split
// across separate brand pages (brand slugs derive from the display name). The
// keys are the spellings that existed in the seed; the values are the display
// names kept. Choices favour the brand's own styling, and where two spellings
// only differ by case or punctuation the majority spelling's slug is preserved.
const BRAND_RENAMES = new Map([
  ["Nomos", "NOMOS"],
  ["NOMOS Glashütte", "NOMOS"],
  ["Glashutte Original", "Glashütte Original"],
  ["JLC", "Jaeger-LeCoultre"],
  ["Casio G-Shock", "Casio"],
  ["G-Shock", "Casio"],
  ["Casio Vintage", "Casio"],
  ["Hermes", "Hermès"],
  ["Bvlgari", "Bulgari"],
  ["Universal Geneve", "Universal Genève"],
  ["Gérald Charles", "Gerald Charles"],
  ["Girard Perregaux", "Girard-Perregaux"],
  ["MING", "Ming"],
  ["YEMA", "Yema"],
  ["Anordain", "anOrdain"],
  ["TITONI", "Titoni"],
  ["CVSTOS", "Cvstos"],
  ["Meistersinger", "MeisterSinger"],
  ["H. Moser & Cie", "H. Moser & Cie."],
  ["Jacob & Co", "Jacob & Co."],
  ["Habring2", "Habring²"],
  ["Monochrome x Habring²", "Habring² x Monochrome"],
  ["Speake Marin", "Speake-Marin"],
  ["AWAKE", "Awake"],
  ["echo/neutra", "Echo/Neutra"],
  ["Meraud", "Méraud"],
  // The brand writes Ōtsuka Lōtec, but the current slugify drops the leading
  // macron letter entirely; keep the ASCII spelling until slugs transliterate.
  ["Ōtsuka Lōtec", "Otsuka Lotec"],
  ["LIP", "Lip"],
  ["Astor+Banks", "Astor + Banks"],
  ["Isotope Watches", "Isotope"],
  ["Cornell Watch Company", "Cornell Watch Co."],
  ["Bangalore Watch Co.", "Bangalore Watch Company"],
  ["Balmont Watches", "Balmont"],
  ["Haim Watch Company", "Haim"],
  ["Reservoir Watches", "Reservoir"],
  ["Brew Watch Co.", "Brew"],
  ["Brew Watch Co. x Worn & Wound", "Brew x Worn & Wound"],
  ["Boldr Supply Co.", "Boldr"],
  ["Merci", "Merci Instruments"],
  ["Venustas Per Constantiam", "VPC"],
  ["Venustas Per Constantiam – VPC", "VPC"],
  ["Le Forban", "Le Forban Sécurité Mer"],
  ["Le Forban Securite Mer", "Le Forban Sécurité Mer"]
]);

// G-Shock is a Casio product line, not a brand. Records that were filed under
// the line name keep the line in the model so the merged Casio page stays
// readable next to the existing "G-Shock …" Casio records.
const LINE_PREFIX_BRANDS = new Map([
  ["Casio G-Shock", "G-Shock"],
  ["G-Shock", "G-Shock"]
]);
const LINE_PREFIX_EXEMPT_PATTERN = /^(?:g-?shock|g-squad|baby-g)\b/iu;

// Curated names for records touched by the merges below. A reference follows
// the model only when it is a product name rather than a product code.
const NAME_FIXES = new Map([
  [1600, "Tangente 38"],
  [1601, "Tangente 38 Date"],
  [1763, "Vintage Back to the Future 40th Anniversary"],
  [2910, "La Rochelaise"]
]);

// Duplicates that only existed because the same watch was filed under two
// brand spellings. The duplicate's sources move to the canonical record; the
// canonical record keeps its own dimensions.
const MERGES = [
  { duplicateId: 4422, canonicalId: 1190, reason: "JLC alias of Jaeger-LeCoultre Master Ultra Thin Moon Q1368430" },
  { duplicateId: 4424, canonicalId: 1921, reason: "JLC alias of Jaeger-LeCoultre Reverso Tribute Chronograph Q389848J" },
  { duplicateId: 4431, canonicalId: 1924, reason: "JLC alias of Jaeger-LeCoultre Reverso Tribute Duoface Tourbillon Q392242J" },
  { duplicateId: 4433, canonicalId: 1930, reason: "JLC alias of Jaeger-LeCoultre Reverso Tribute Monoface Q716848J" },
  { duplicateId: 4630, canonicalId: 1600, reason: "Nomos alias of NOMOS Tangente 38 reference 164" },
  { duplicateId: 4638, canonicalId: 1601, reason: "Nomos alias of NOMOS Tangente 38 Date reference 130" },
  { duplicateId: 3024, canonicalId: 1763, reason: "Casio OUTATIME CA-500W is the Back to the Future CA-500WEBF-1A" },
  { duplicateId: 6128, canonicalId: 6928, reason: "Venustas Per Constantiam alias of VPC Type 37HW" },
  { duplicateId: 7099, canonicalId: 2910, reason: "Le Forban Sécurité Mer La Rochelaise filed under two brand spellings" }
];

function normalizedUrl(value) {
  return String(value ?? "").replace(/\/$/u, "");
}

function appendSource(target, source, duplicate, reason) {
  if (target.sources.some((item) => normalizedUrl(item.sourceUrl) === normalizedUrl(source.sourceUrl))) return false;

  let note = source.note;
  if (note) {
    const identity = `for ${duplicate.brand} ${duplicate.model} in “`;
    const replacement = `for ${target.brand} ${target.model} (${target.reference}) in “`;
    note = note.replace(identity, replacement);

    const sameCase = Number(duplicate.caseMm) === Number(target.caseMm);
    const sameLugToLug = Number(duplicate.lugToLugMm) === Number(target.lugToLugMm);
    if (!sameCase || !sameLugToLug) {
      note += ` Canonical target dimensions retained: ${target.caseMm}mm case and ${target.lugToLugMm}mm lug-to-lug (${reason}).`;
    }
  }

  target.sources.push({ ...source, note });
  return true;
}

function isProductCode(reference) {
  return /\d/u.test(String(reference));
}

function prefixedName(prefix, value) {
  return LINE_PREFIX_EXEMPT_PATTERN.test(value) ? value : `${prefix} ${value}`;
}

const watches = JSON.parse(await readFile(seedPath, "utf8"));
const watchesById = new Map(watches.map((watch) => [watch.id, watch]));

for (const spelling of BRAND_RENAMES.keys()) {
  if (!watches.some((watch) => watch.brand === spelling)) {
    throw new Error(`No seed records use the brand spelling “${spelling}”; remove it from BRAND_RENAMES.`);
  }
}

const renamedBrands = [];
const renamedModels = [];
const renamedGroups = [];
const unresolvedGroups = [];

for (const watch of watches) {
  const nextBrand = BRAND_RENAMES.get(watch.brand);
  if (!nextBrand) continue;

  const previousBrand = watch.brand;
  const previousBrandSlug = slugify(previousBrand);
  const nextBrandSlug = slugify(nextBrand);
  watch.brand = nextBrand;
  renamedBrands.push({ id: watch.id, from: previousBrand, to: nextBrand });

  const linePrefix = LINE_PREFIX_BRANDS.get(previousBrand);
  if (linePrefix) {
    const previousModel = watch.model;
    const nextModel = prefixedName(linePrefix, previousModel);
    if (nextModel !== previousModel) {
      watch.model = nextModel;
      if (watch.reference === previousModel && !isProductCode(previousModel)) watch.reference = nextModel;
      renamedModels.push({ id: watch.id, from: previousModel, to: nextModel, reference: watch.reference });
    }
    if (watch.canonicalModel) watch.canonicalModel = prefixedName(linePrefix, watch.canonicalModel);
  }

  if (watch.modelGroup) {
    const expectedGroup = `${nextBrandSlug}-${slugify(watch.canonicalModel ?? "")}`;
    const previousGroup = watch.modelGroup;
    const previousExpected = `${previousBrandSlug}-${slugify(
      linePrefix ? previousGroup.slice(previousBrandSlug.length + 1) : watch.canonicalModel ?? ""
    )}`;
    if (previousGroup === previousExpected || previousGroup.startsWith(`${previousBrandSlug}-`)) {
      if (previousGroup !== expectedGroup) {
        watch.modelGroup = expectedGroup;
        renamedGroups.push({ id: watch.id, from: previousGroup, to: expectedGroup });
      }
    } else {
      unresolvedGroups.push({ id: watch.id, modelGroup: previousGroup, brand: nextBrand });
    }
  }
}

const changedNames = [];
for (const [id, model] of NAME_FIXES) {
  const watch = watchesById.get(id);
  if (!watch) throw new Error(`Missing watch ${id} for name normalization.`);
  const previousModel = watch.model;
  const previousReference = watch.reference;
  watch.model = model;
  if (previousReference === previousModel && !isProductCode(previousReference)) watch.reference = model;
  changedNames.push({ id, fromModel: previousModel, toModel: model, fromReference: previousReference, toReference: watch.reference });
}

const retiredIds = new Set();
const mergeResults = [];
let transferredSourceCount = 0;

for (const merge of MERGES) {
  const duplicate = watchesById.get(merge.duplicateId);
  const target = watchesById.get(merge.canonicalId);
  if (!duplicate) throw new Error(`Missing duplicate watch ${merge.duplicateId}.`);
  if (!target) throw new Error(`Missing canonical watch ${merge.canonicalId} for duplicate ${merge.duplicateId}.`);
  if (duplicate.brand !== target.brand) {
    throw new Error(`Duplicate ${merge.duplicateId} (${duplicate.brand}) and canonical ${merge.canonicalId} (${target.brand}) differ by brand.`);
  }

  let transferred = 0;
  for (const source of duplicate.sources) {
    if (appendSource(target, source, duplicate, merge.reason)) transferred += 1;
  }
  transferredSourceCount += transferred;
  retiredIds.add(merge.duplicateId);
  mergeResults.push({ ...merge, transferredSourceCount: transferred });
}

const finalWatches = watches.filter((watch) => !retiredIds.has(watch.id));
const report = {
  generatedAt: new Date().toISOString(),
  apply,
  initialWatchCount: watches.length,
  finalWatchCount: finalWatches.length,
  renamedBrandCount: renamedBrands.length,
  renamedBrandSpellings: [...BRAND_RENAMES.entries()].map(([from, to]) => ({
    from,
    to,
    count: renamedBrands.filter((entry) => entry.from === from).length
  })),
  renamedModels,
  renamedGroups,
  unresolvedGroups,
  changedNames,
  retiredIds: [...retiredIds].sort((left, right) => left - right),
  mergeResults,
  transferredSourceCount
};

if (unresolvedGroups.length > 0) {
  throw new Error(`Model groups need a manual key: ${JSON.stringify(unresolvedGroups)}`);
}

if (apply) await writeFile(seedPath, `${JSON.stringify(finalWatches, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `Brand name normalization ${apply ? "applied" : "previewed"}: ${renamedBrands.length} records renamed across ` +
    `${BRAND_RENAMES.size} spellings, ${renamedModels.length} line-prefixed models, ${renamedGroups.length} model groups rekeyed, ` +
    `${changedNames.length} curated names, ${MERGES.length} duplicates merged, ${transferredSourceCount} sources transferred.\n`
);

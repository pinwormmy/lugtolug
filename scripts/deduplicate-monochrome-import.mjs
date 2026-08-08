import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const reportPath = resolve(argumentValue("report") ?? "/private/tmp/monochrome-dedup-result.json");
const apply = process.argv.includes("--apply");

const duplicateMerges = [
  { duplicateId: 6984, canonicalIds: [347], reason: "Omega Silver Snoopy ref. 310.32.42.50.02.001" },
  { duplicateId: 7036, canonicalIds: [427, 430, 435, 438], reason: "Omega Constellation references named in the article" },
  { duplicateId: 7093, canonicalIds: [2851], reason: "Czapek Place Vendome Complicite" },
  { duplicateId: 7135, canonicalIds: [364], reason: "Omega First Omega in Space ref. 310.30.40.50.06.001" },
  { duplicateId: 7151, canonicalIds: [1211, 2168, 2169, 2170, 2171], reason: "TAG Heuer Formula 1 mechanical collection" },
  { duplicateId: 7165, canonicalIds: [6117], reason: "Nivada Grenchen F77 Mk2" },
  { duplicateId: 7167, canonicalIds: [4130, 4131, 4136, 4161, 4164], reason: "Farer Lissom five-model collection" },
  { duplicateId: 7169, canonicalIds: [308, 311, 312, 319], reason: "Omega Railmaster 2025 four-reference collection" },
  { duplicateId: 7175, canonicalIds: [1825, 1826], reason: "Glashutte Original PanoLunarTourbillon strap references" },
  { duplicateId: 7227, canonicalIds: [1934, 1935], reason: "Kiwame Tokyo MUNE KT201 and KT202" },
  { duplicateId: 7232, canonicalIds: [872, 873, 874, 875], reason: "Seiko HDB006 through HDB009" },
  { duplicateId: 7234, canonicalIds: [2738], reason: "Timex Giorgio Galli S2Ti" },
  { duplicateId: 7248, canonicalIds: [6264, 6265, 6266, 6267], reason: "Studio Underd0g 02Series Gen 2 references" },
  { duplicateId: 7267, canonicalIds: [6694], reason: "Konstantin Chaykin Cinema" },
  { duplicateId: 7280, canonicalIds: [6839], reason: "HYT H3" },
  { duplicateId: 7336, canonicalIds: [6629], reason: "Hamilton PSR" },
  { duplicateId: 7339, canonicalIds: [6085, 6725], reason: "Baume & Mercier Hampton 2020 models" },
  { duplicateId: 7353, canonicalIds: [6837], reason: "Hermes H08 2021 collection" },
  { duplicateId: 7371, canonicalIds: [6824], reason: "Girard-Perregaux Casquette 2.0" },
  { duplicateId: 7404, canonicalIds: [2199, 2200, 2201], reason: "Tissot Sideral three-reference collection" },
  { duplicateId: 7427, canonicalIds: [6647], reason: "Cartier Prive Tortue Monopusher Chronograph 2024" },
  { duplicateId: 7430, canonicalIds: [6721], reason: "Anoma A1 launch model" },
  { duplicateId: 7448, canonicalIds: [348], reason: "Omega Speedmaster ref. 311.90.42.30.99.002" },
  { duplicateId: 7450, canonicalIds: [3318, 3321, 3322, 3324], reason: "Bianchet B 1.618 UltraFino titanium variants" }
];

const sourceCorrections = [
  {
    fromId: 6966,
    sourceUrl: "https://monochrome-watches.com/introducing-new-march-lab-mansart-small-second-collection-price-price/",
    toIds: [],
    reason: "The Small Second article is already attached to the correct 35mm record 2643."
  },
  {
    fromId: 7354,
    sourceUrl: "https://monochrome-watches.com/introducing-gerald-charles-maestro-3-0-chronograph-2023-seddiqi-special-meteorite-dial-sandblasted-titanium-specs-price/",
    toIds: [],
    reason: "The Maestro 3.0 article is already attached to the correct chronograph record 7359."
  },
  {
    fromId: 7354,
    sourceUrl: "https://monochrome-watches.com/introducing-gerald-charles-genta-maestro-9-0-roman-tourbillon-hand-hammered-dial-vaucher-specs-price/",
    toIds: [7396],
    reason: "Move the Maestro 9.0 Roman Tourbillon source from the Maestro 2.0 record.",
    correctedNote:
      "MONOCHROME reports 41mm lug-to-lug, 39mm case size/width for Gerald Charles Maestro 9.0 Roman Tourbillon in “The New Gerald Charles Maestro 9.0 Roman Tourbillon with a Hand-Hammered Gold Dial.” The article's explicit planar case length/top-to-bottom dimension is stored as the lug-to-lug equivalent. The seed retains its existing 41.7mm value pending conflict resolution."
  }
];

function normalizedUrl(value) {
  return String(value ?? "").replace(/\/$/u, "");
}

function appendSource(watch, source) {
  const sourceUrl = normalizedUrl(source.sourceUrl);
  if (watch.sources.some((item) => normalizedUrl(item.sourceUrl) === sourceUrl)) return false;
  watch.sources.push(source);
  return true;
}

const watches = JSON.parse(await readFile(seedPath, "utf8"));
const watchesById = new Map(watches.map((watch) => [watch.id, watch]));
const retiredIds = new Set();
const mergeResults = [];
let transferredSourceCount = 0;

for (const merge of duplicateMerges) {
  const duplicate = watchesById.get(merge.duplicateId);
  if (!duplicate) {
    mergeResults.push({ ...merge, status: "already-retired", transferredSourceCount: 0 });
    continue;
  }

  const canonicalWatches = merge.canonicalIds.map((id) => {
    const watch = watchesById.get(id);
    if (!watch) throw new Error(`Missing canonical watch ${id} for duplicate ${merge.duplicateId}.`);
    return watch;
  });

  let transferredForMerge = 0;
  for (const canonical of canonicalWatches) {
    for (const source of duplicate.sources) {
      if (appendSource(canonical, source)) transferredForMerge += 1;
    }
  }
  transferredSourceCount += transferredForMerge;
  retiredIds.add(duplicate.id);
  mergeResults.push({ ...merge, status: "merged", transferredSourceCount: transferredForMerge });
}

const sourceCorrectionResults = [];
let updatedSourceNoteCount = 0;
for (const correction of sourceCorrections) {
  const sourceWatch = watchesById.get(correction.fromId);
  if (!sourceWatch) throw new Error(`Missing source-correction watch ${correction.fromId}.`);
  const sourceIndex = sourceWatch.sources.findIndex(
    (source) => normalizedUrl(source.sourceUrl) === normalizedUrl(correction.sourceUrl)
  );
  if (sourceIndex < 0) {
    let updatedForCorrection = 0;
    for (const id of correction.toIds) {
      const target = watchesById.get(id);
      if (!target) throw new Error(`Missing source-correction target ${id}.`);
      const existingSource = target.sources.find(
        (source) => normalizedUrl(source.sourceUrl) === normalizedUrl(correction.sourceUrl)
      );
      if (existingSource && correction.correctedNote && existingSource.note !== correction.correctedNote) {
        existingSource.note = correction.correctedNote;
        updatedForCorrection += 1;
      }
    }
    updatedSourceNoteCount += updatedForCorrection;
    sourceCorrectionResults.push({
      ...correction,
      status: updatedForCorrection ? "note-corrected" : "already-corrected",
      transferredSourceCount: 0,
      updatedSourceNoteCount: updatedForCorrection
    });
    continue;
  }

  const [source] = sourceWatch.sources.splice(sourceIndex, 1);
  let transferredForCorrection = 0;
  for (const id of correction.toIds) {
    const target = watchesById.get(id);
    if (!target) throw new Error(`Missing source-correction target ${id}.`);
    const correctedSource = correction.correctedNote ? { ...source, note: correction.correctedNote } : source;
    if (appendSource(target, correctedSource)) transferredForCorrection += 1;
  }
  transferredSourceCount += transferredForCorrection;
  sourceCorrectionResults.push({ ...correction, status: "corrected", transferredSourceCount: transferredForCorrection });
}

const finalWatches = watches.filter((watch) => !retiredIds.has(watch.id));
const report = {
  generatedAt: new Date().toISOString(),
  apply,
  initialWatchCount: watches.length,
  finalWatchCount: finalWatches.length,
  retiredWatchCount: retiredIds.size,
  transferredSourceCount,
  correctedSourceAssociationCount: sourceCorrectionResults.filter((item) => item.status === "corrected").length,
  updatedSourceNoteCount,
  mergeResults,
  sourceCorrectionResults
};

if (apply) await writeFile(seedPath, `${JSON.stringify(finalWatches, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `MONOCHROME dedup ${apply ? "applied" : "previewed"}: ${retiredIds.size} watches retired, ` +
    `${transferredSourceCount} sources transferred, ${report.correctedSourceAssociationCount} source associations corrected, ` +
    `${updatedSourceNoteCount} source notes updated.\n`
);

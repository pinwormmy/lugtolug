import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const summaryPath = resolve(argumentValue("input") ?? "/private/tmp/hodinkee-lug-candidates.json");
const proposalsPath = resolve(argumentValue("proposals") ?? "/private/tmp/hodinkee-lug-proposals.json");
const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const reportPath = resolve(argumentValue("report") ?? "/private/tmp/hodinkee-import-report.json");
const apply = process.argv.includes("--apply");

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function compact(value) {
  return normalize(value).replace(/ /gu, "");
}

function normalizedUrl(value) {
  return String(value ?? "").replace(/\/$/u, "");
}

function brandKey(value) {
  const key = compact(value)
    .replace(/^tagheuer$/u, "tagheuer")
    .replace(/^glashutteoriginal$/u, "glashutteoriginal")
    .replace(/^astorbanks$/u, "astorbanks");
  const aliases = new Map([
    ["iwcschaffhausen", "iwc"],
    ["mingjnshapiro", "ming"],
    ["mingxjnshapiro", "ming"],
    ["jnshapiroming", "ming"],
    ["monochromexhabring2", "habring2monochrome"],
    ["monochromehabring2", "habring2monochrome"],
    ["habring2xmonochrome", "habring2monochrome"],
    ["habring2monochrome", "habring2monochrome"]
  ]);
  return aliases.get(key) ?? key;
}

function brandRelated(left, right) {
  const leftKey = brandKey(left);
  const rightKey = brandKey(right);
  return (
    leftKey === rightKey ||
    (leftKey.length >= 5 && rightKey.includes(leftKey)) ||
    (rightKey.length >= 5 && leftKey.includes(rightKey))
  );
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))];
}

function validNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function sameMetric(left, right, tolerance) {
  return left == null || right == null || Math.abs(Number(left) - Number(right)) <= tolerance;
}

function sourceAlreadyPresent(watch, url) {
  const key = normalizedUrl(url);
  return watch.sources.some((source) => normalizedUrl(source.sourceUrl) === key);
}

function referenceFactSegments(candidate) {
  const values = candidate.facts
    .filter((fact) => /^reference(?: number)?$/iu.test(fact.label))
    .map((fact) => fact.value);
  const references = [];

  for (const value of values) {
    for (const rawSegment of value.split(/\s*(?:;|,(?=\s*[^,]*\d)|\bor\b|\band\b)\s*/iu)) {
      let segment = rawSegment
        .replace(/^ref(?:erence)?\.?\s*/iu, "")
        .replace(/\s*\([^)]*\)\s*$/u, "")
        .trim();
      segment = segment.replace(/^(?:Arctic|Pacific|Atlantic|Indian|Antarctic) Ocean\//iu, "");
      if (!segment || !/\d/u.test(segment)) continue;
      references.push(segment);
    }
  }

  return unique(references);
}

function sourceNote(record, candidate, { retainedValue } = {}) {
  const metrics = [
    `${record.approximate ? "approximately " : ""}${record.lugToLugMm}mm lug-to-lug`,
    record.caseMm == null || record.caseReported === false ? null : `${record.caseMm}mm case size/width`,
    record.thicknessMm == null ? null : `${record.thicknessMm}mm thickness`,
    record.lugWidthMm == null ? null : `${record.lugWidthMm}mm lug width`
  ].filter(Boolean);
  const retained = retainedValue == null ? "" : ` The seed retains its existing ${retainedValue}mm value pending conflict resolution.`;
  const semantic = record.semantic
    ? " The article's planar case length/top-to-bottom dimension is stored as the lug-to-lug equivalent."
    : "";
  const qualifier = record.noteSuffix ? ` ${record.noteSuffix}` : "";
  return `Hodinkee reports ${metrics.join(", ")} for ${record.brand} ${record.model} in “${candidate.title}.”${semantic}${qualifier}${retained}`;
}

const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const proposalFile = JSON.parse(await readFile(proposalsPath, "utf8"));
const watches = JSON.parse(await readFile(seedPath, "utf8"));
const candidatesByUrl = new Map(summary.candidates.map((candidate) => [normalizedUrl(candidate.url), candidate]));
let nextId = Math.max(...watches.map((watch) => Number(watch.id))) + 1;

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  sitemapArticleCount: summary.sitemapArticleCount,
  completedArticleCount: summary.completedArticleCount,
  failureCount: summary.failureCount,
  candidateCount: summary.candidateCount,
  directCandidateCount: summary.directCandidateCount,
  added: [],
  augmented: [],
  corrected: [],
  sourceCorrections: [],
  sourceCorrectionCount: 0,
  conflicts: [],
  excluded: []
};

function appendSource(watch, candidate, note) {
  if (sourceAlreadyPresent(watch, candidate.url)) return false;
  watch.sources.push({ sourceUrl: candidate.url, note });
  report.augmented.push({ id: watch.id, brand: watch.brand, model: watch.model, reference: watch.reference, url: candidate.url });
  return true;
}

function exactReferenceMatches(record) {
  const key = compact(record.reference);
  if (!key) return [];
  return watches.filter((watch) => brandRelated(watch.brand, record.brand) && compact(watch.reference) === key);
}

function fallbackMatches(record, candidate) {
  const modelKey = normalize(record.model);
  const referenceKey = normalize(record.reference);
  const modelRelated = (watch) =>
    [watch.model, watch.canonicalModel, watch.reference]
      .map(normalize)
      .some(
        (value) =>
          value &&
          (value === modelKey ||
            value === referenceKey ||
            (value.length >= 8 && modelKey.includes(value)) ||
            (modelKey.length >= 8 && value.includes(modelKey)))
      );
  const sourceMatches = watches.filter(
    (watch) =>
      brandRelated(watch.brand, record.brand) &&
      modelRelated(watch) &&
      sourceAlreadyPresent(watch, candidate.url) &&
      sameMetric(watch.lugToLugMm, record.lugToLugMm, 0.5) &&
      sameMetric(watch.caseMm, record.caseMm, 0.4)
  );
  if (sourceMatches.length) return sourceMatches;

  const relatedMatches = watches.filter((watch) => {
    if (!brandRelated(watch.brand, record.brand)) return false;
    if (!modelRelated(watch)) return false;
    return (
      sameMetric(watch.lugToLugMm, record.lugToLugMm, 0.5) &&
      sameMetric(watch.caseMm, record.caseMm, 0.4)
    );
  });
  if (relatedMatches.length <= 1) return relatedMatches;

  const articleIdentityText = normalize(
    [candidate.url, candidate.title, ...candidate.facts.map((fact) => `${fact.label} ${fact.value}`)].join(" ")
  );
  const articleIdentityCompact = compact(articleIdentityText);
  const qualifiedMatches = relatedMatches.filter((watch) => {
    const watchModel = normalize(watch.canonicalModel ?? watch.model);
    const watchReference = compact(watch.reference);
    const modelIsExplicit =
      watchModel.length >= 6 && (` ${articleIdentityText} `).includes(` ${watchModel} `);
    const referenceIsExplicit =
      watchReference.length >= 4 && /\d/u.test(watchReference) && articleIdentityCompact.includes(watchReference);
    return modelIsExplicit || referenceIsExplicit;
  });

  return qualifiedMatches;
}

function applyRecord(rawRecord, candidate) {
  const record = {
    ...rawRecord,
    reference: rawRecord.reference ?? rawRecord.model,
    referenceIsFallback: rawRecord.referenceIsFallback ?? rawRecord.reference == null,
    thicknessMm: rawRecord.thicknessMm ?? null,
    lugWidthMm: rawRecord.lugWidthMm ?? null,
    approximate: rawRecord.approximate ?? false
  };

  if (!validNumber(record.lugToLugMm) || record.lugToLugMm < 15 || record.lugToLugMm > 75) {
    throw new Error(`Invalid lug-to-lug value for ${record.brand} ${record.model}: ${record.lugToLugMm}`);
  }
  if (!validNumber(record.caseMm) || record.caseMm < 8 || record.caseMm > 65) {
    throw new Error(`Invalid case value for ${record.brand} ${record.model}: ${record.caseMm}`);
  }

  const matches = exactReferenceMatches(record);
  if (matches.length) {
    for (const watch of matches) {
      const agrees =
        sameMetric(watch.lugToLugMm, record.lugToLugMm, 0.5) && sameMetric(watch.caseMm, record.caseMm, 0.4);
      if (!agrees) {
        report.conflicts.push({
          id: watch.id,
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          seedLugToLugMm: watch.lugToLugMm,
          hodinkeeLugToLugMm: record.lugToLugMm,
          seedCaseMm: watch.caseMm,
          hodinkeeCaseMm: record.caseMm,
          url: candidate.url
        });
      }
      appendSource(
        watch,
        candidate,
        sourceNote(record, candidate, { retainedValue: agrees ? null : watch.lugToLugMm })
      );
    }
    return;
  }

  if (record.referenceIsFallback) {
    const fallback = fallbackMatches(record, candidate);
    if (fallback.length) {
      for (const watch of fallback) appendSource(watch, candidate, sourceNote(record, candidate));
      return;
    }
  }

  const watch = {
    id: nextId++,
    brand: record.brand,
    model: record.model,
    reference: record.reference,
    lugToLugMm: record.lugToLugMm,
    caseMm: record.caseMm,
    thicknessMm: record.thicknessMm,
    lugWidthMm: record.lugWidthMm,
    sources: [{ sourceUrl: candidate.url, note: sourceNote(record, candidate) }]
  };
  watches.push(watch);
  report.added.push({ id: watch.id, brand: watch.brand, model: watch.model, reference: watch.reference, url: candidate.url });
}

const rejectedArticleFragments = new Map([
  ["https://www.hodinkee.com/articles/longines-heritage-classic", "article says the lug-to-lug value was not yet available"],
  ["the-new-hamilton-khaki-field-titanium-automatic-evolves-a-classic-design", "38mm is the case diameter, not lug-to-lug"],
  ["breguet-tradition-gmt", "38mm describes a comparison model's case diameter"],
  ["timex-teams-up-with-the-unmatched-wit", "18mm is the lug width and is not a plausible planar case length"],
  ["the-longines-hydroconquest-gmt", "article explicitly says the new model's lug-to-lug was not supplied"],
  ["blancpain-doubles-down-on-purpose-built-tools", "reviewer explicitly says the lug-to-lug could not be measured"],
  ["breitling-navitimer-8-b01-chronograph-hands-on", "reviewer explicitly says no lug-to-lug measurement was taken"],
  ["longines-spirit-pilots-watch-in-40mm-and-42mm", "article explicitly says the lug-to-lug dimensions were unstated"],
  ["the-blancpain-fifty-fathoms-70th-anniversary-act-3", "article explicitly says no lug-to-lug dimension was available"],
  ["the-seiko-prospex-sla065-save-the-ocean", "article explicitly says Seiko did not provide a lug-to-lug length"],
  ["the-tudor-pelagos-ultra", "article explicitly says no lug-to-lug dimension was available"],
  ["the-zenith-defy-skyline-chronograph", "article explicitly says the lug-to-lug dimension was not shared"],
  ["rolex-submariner-desk-clock-ref-909010ln", "article explicitly says lug-to-lug is not applicable to the desk clock"]
]);

function matchesArticleLocator(url, locator) {
  return /^https?:\/\//iu.test(locator)
    ? normalizedUrl(url) === normalizedUrl(locator)
    : url.includes(locator);
}

function rejectedReason(url) {
  for (const [fragment, reason] of rejectedArticleFragments) {
    if (matchesArticleLocator(url, fragment)) return reason;
  }
  return null;
}

// Do not attach an article merely because a seed row has the same dimensions
// or a generic reference token. Every source association below is made through
// an explicit structured proposal or a manually reviewed record identity.

const structuredOverrides = [
  {
    urlIncludes: "introducing-live-pics-daniel-roth-platinum-extra-plat",
    records: [{
      brand: "Daniel Roth",
      model: "Extra Plat Platinum",
      reference: "Extra Plat Platinum",
      lugToLugMm: 38.6,
      caseMm: 35.5,
      thicknessMm: 7.7
    }]
  },
  {
    urlIncludes: "the-doxa-sub-600t-pacific-limited-edition",
    records: [{ brand: "Doxa", model: "SUB 600T Pacific Limited Edition", reference: "861.50.231.33", lugToLugMm: 47.6, caseMm: 40, thicknessMm: 14.15, approximate: true }]
  },
  {
    urlIncludes: "the-tudor-pelagos-fxd-chrono-cycling-edition",
    records: [{ brand: "Tudor", model: "Pelagos FXD Chrono Cycling Edition", reference: "M25827KN-0001", lugToLugMm: 53, caseMm: 43, thicknessMm: 14.4 }]
  },
  {
    urlIncludes: "the-omega-seamaster-railmaster-refreshed-for-2025",
    records: [
      "235.10.38.20.06.001",
      "235.12.38.20.06.001",
      "235.10.38.20.13.001",
      "235.12.38.20.13.001"
    ].map((reference) => ({
      brand: "Omega",
      model: "Seamaster Railmaster 2025",
      reference,
      lugToLugMm: 44.9,
      caseMm: 38,
      thicknessMm: 12.4
    }))
  },
  {
    urlIncludes: "introducing-christopher-ward-bel-canto-classic",
    records: [{ brand: "Christopher Ward", model: "C1 Bel Canto Classic", reference: "C1 Bel Canto Classic", lugToLugMm: 48, caseMm: 41, thicknessMm: 13 }]
  },
  {
    urlIncludes: "christopher-ward-goes-all-out-on-lume-with-the-c1-bel-canto-lumiere",
    records: [{ brand: "Christopher Ward", model: "C1 Bel Canto Lumière", reference: "C1 Bel Canto Lumière", lugToLugMm: 48, caseMm: 41, thicknessMm: 13.65 }]
  },
  {
    urlIncludes: "doxa-sub-300t-divingstar-poseidon-edition-introducing",
    records: [{ brand: "Doxa", model: "SUB 300T Divingstar Poseidon Edition", reference: "SUB 300T Divingstar Poseidon Edition", lugToLugMm: 45, caseMm: 42.7, approximate: true }]
  },
  {
    urlIncludes: "the-atelier-wen-millesime-2025-perception-live-pics",
    records: [{ brand: "Atelier Wen", model: "Millésime 2025 Perception Limited Edition", reference: "Millésime 2025 Perception", lugToLugMm: 47, caseMm: 40, thicknessMm: 9.4 }]
  },
  {
    urlIncludes: "grand-seiko-launches-two-new-tentagraphs",
    records: [{ brand: "Grand Seiko", model: "Evolution 9 Tentagraph", reference: "SLGC007", lugToLugMm: 51.5, caseMm: 43.2, thicknessMm: 15.3 }]
  },
  {
    urlIncludes: "the-christopher-ward-c60-trident-lumiere-green-fifteen-x-bark-and-jack",
    records: [{ brand: "Christopher Ward x Bark & Jack", model: "C60 Trident Lumière Green Fifteen", lugToLugMm: 47.9, caseMm: 41, thicknessMm: 10.85 }]
  },
  {
    urlIncludes: "intro-bnd-diver-2026",
    records: ["MNGRA", "MNWHI", "MNKHA"].map((reference) => ({
      brand: "BND",
      model: "MN Diver",
      reference,
      lugToLugMm: 47,
      caseMm: 39.5,
      thicknessMm: 13
    }))
  },
  {
    urlIncludes: "introducing-albishorn-marinagraph",
    records: ["Classic Racing", "Paraíba Racing"].map((variant) => ({
      brand: "Albishorn",
      model: `Marinagraph ${variant}`,
      reference: `Marinagraph ${variant}`,
      lugToLugMm: 47.7,
      caseMm: 39,
      thicknessMm: 13
    }))
  },
  {
    urlIncludes: "naoya-hida-launches-its-fourth-series-now-with-a-36mm-case",
    records: ["NH Type 4A", "NH Type 4A-1"].map((reference) => ({
      brand: "Naoya Hida & Co.",
      model: reference,
      reference,
      lugToLugMm: 43,
      caseMm: 36,
      thicknessMm: 11
    }))
  },
  {
    urlIncludes: "worn-and-wound-x-christopher-ward-limited-edition-c65-sandstorm",
    records: ["C65 Sandstorm", "C65 Sandstorm Blackout"].map((reference) => ({
      brand: "Worn & Wound x Christopher Ward",
      model: reference,
      reference,
      lugToLugMm: 43.6,
      caseMm: 38,
      thicknessMm: 11.6,
      lugWidthMm: 20
    }))
  },
  {
    urlIncludes: "zodiac-and-worn-and-wound-team-up-again-this-time-for-a-game-of-laser-tag",
    records: ["Ultraviolet", "Infrared"].map((variant) => ({
      brand: "Zodiac x Worn & Wound",
      model: `Super Sea Wolf ${variant}`,
      reference: `Super Sea Wolf ${variant}`,
      lugToLugMm: 49,
      caseMm: 40,
      thicknessMm: 13.6,
      lugWidthMm: 20
    }))
  },
  {
    urlIncludes: "cartier-santos-all-black",
    records: [{ brand: "Cartier", model: "Santos de Cartier Large All Black", reference: "WSSA0062", lugToLugMm: 47.5, caseMm: 39.8, thicknessMm: 9.38 }]
  },
  {
    urlIncludes: "the-tutima-m2-seven-seas",
    records: [{ brand: "Tutima", model: "M2 Seven Seas", lugToLugMm: 44, caseMm: 44, approximate: true, noteSuffix: "Hodinkee infers the square 44mm footprint from the bezel and hooded-lug geometry." }]
  },
  {
    urlIncludes: "the-doxa-sub-250t-gmt",
    records: [{ brand: "Doxa", model: "SUB 250T GMT", lugToLugMm: 42.9, caseMm: 40, thicknessMm: 10.85 }]
  },
  {
    urlIncludes: "the-doxa-sub-300-ti5-clive-cussler",
    records: [{ brand: "Doxa", model: "SUB 300 Ti5 Clive Cussler", reference: "823.50.121.20-SE14", lugToLugMm: 45, caseMm: 42.5, thicknessMm: 13.4 }]
  },
  {
    urlIncludes: "the-grand-seiko-sbgy043-iwao-blue",
    records: [{ brand: "Grand Seiko", model: "SBGY043 Iwao Blue", reference: "SBGY043", lugToLugMm: 43.7, caseMm: 38.5, thicknessMm: 10.2 }]
  },
  {
    urlIncludes: "the-richard-mille-rm-35-03-automatic",
    records: [{ brand: "Richard Mille", model: "RM 35-03 Automatic Rafael Nadal", reference: "RM 35-03", lugToLugMm: 49.95, caseMm: 43.15, thicknessMm: 13.15 }]
  },
  {
    urlIncludes: "kollokium-projekt-02-variant-b-2",
    records: [{ brand: "Kollokium", model: "PROJEKT 02 VARIANT B", lugToLugMm: 46, caseMm: 39.5, thicknessMm: 12.4, approximate: true, noteSuffix: "The full height including the sapphire crystal is 12.4mm; 5.9mm is the mid-case height alone." }]
  },
  {
    urlIncludes: "introducing-oris-star-edition",
    records: [{ brand: "Oris", model: "Star Edition", reference: "733 7813 4151-07 5 17 02", lugToLugMm: 41.5, caseMm: 35, thicknessMm: 11.1 }]
  },
  {
    urlIncludes: "the-muppets-are-back-with-the-oris-propilot-x-miss-piggy",
    records: [{ brand: "Oris", model: "ProPilot X Miss Piggy Edition", reference: "531 7796 4158-07 8 17 05LC", lugToLugMm: 41.5, caseMm: 34, thicknessMm: 11 }]
  },
  {
    urlIncludes: "the-oris-divers-sixty-five-60th-anniversary",
    records: [{ brand: "Oris", model: "Divers Sixty-Five 60th Anniversary Edition", reference: "01 733 7772 4034-Set", lugToLugMm: 46, caseMm: 40, thicknessMm: 12.8 }]
  },
  {
    urlIncludes: "the-oris-new-york-harbor-limited-edition-ii",
    records: [{ brand: "Oris", model: "Aquis Date New York Harbor Limited Edition II", reference: "733 7789 4187 07-Set", lugToLugMm: 51, caseMm: 43.5, thicknessMm: 13.1 }]
  },
  {
    urlIncludes: "four-new-breitling-classic-avis",
    records: ["A233801A1C1A1", "A233801A1C1X1", "A233803A1B1A1", "A233803A1B1X1", "R233801A1B1R1", "R233801A1B1X1", "Y233801A1B1A1", "Y233801A1B1X1"].map((reference) => ({
      brand: "Breitling",
      model: "Classic AVI 42",
      reference,
      lugToLugMm: 48,
      caseMm: 42,
      thicknessMm: 14.7
    }))
  },
  {
    urlIncludes: "four-new-seiko-5-sports-models",
    records: ["SRPK09", "SRPK11", "SRPK13"].map((reference) => ({ brand: "Seiko", model: "5 Sports 1968 Recreation", reference, lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.4 }))
  },
  {
    urlIncludes: "intro-mbandf-legacy-machines-longhorn",
    records: [
      { brand: "MB&F", model: "LM Perpetual Longhorn", lugToLugMm: 53.99, caseMm: 44, thicknessMm: 17.5 },
      { brand: "MB&F", model: "LM Sequential Flyback Longhorn", lugToLugMm: 53.99, caseMm: 44, thicknessMm: 18.2 }
    ]
  },
  {
    urlIncludes: "rado-tradition-1965-limited-editions",
    records: [
      { brand: "Rado", model: "Tradition 1965 M Auto", reference: "561.0019.3.110", lugToLugMm: 35, caseMm: 35, thicknessMm: 10.6 },
      { brand: "Rado", model: "Tradition 1965 M Auto", reference: "561.0018.3.170", lugToLugMm: 35, caseMm: 35, thicknessMm: 10.6 }
    ]
  },
  {
    urlIncludes: "the-seiko-black-series-grows",
    records: [{ brand: "Seiko", model: "Prospex Speedtimer Black Series", reference: "SSC923", lugToLugMm: 45.9, caseMm: 41.4, thicknessMm: 13, lugWidthMm: 21 }]
  },
  {
    urlIncludes: "universal-geneve-reimagines-the-disco-volante",
    records: ["UGUC001", "UGUC002"].map((reference) => ({ brand: "Universal Genève", model: "Disco Volante Signature", reference, lugToLugMm: 45, caseMm: 45, thicknessMm: 12.78, lugWidthMm: 20 }))
  },
  {
    urlIncludes: "the-universal-geneve-cabriolet",
    records: ["UGCA006", "UGCA004", "UGCA001", "UGCA002", "UGCC001"].map((reference) => ({ brand: "Universal Genève", model: "Cabriolet", reference, lugToLugMm: 45, caseMm: 24.2, thicknessMm: 8 }))
  },
  {
    urlIncludes: "the-unimatic-toolwatch-series",
    records: [
      { brand: "Unimatic", model: "Toolwatch UT1", reference: "UT1", lugToLugMm: 49, caseMm: 40, thicknessMm: 13.2, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Toolwatch UT4", reference: "UT4", lugToLugMm: 49, caseMm: 40, thicknessMm: 12, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Toolwatch UT1-GMT", reference: "UT1-GMT", lugToLugMm: 49, caseMm: 40, thicknessMm: 13.2, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Toolwatch UT4-GMT", reference: "UT4-GMT", lugToLugMm: 49, caseMm: 40, thicknessMm: 12, lugWidthMm: 22 }
    ]
  },
  {
    urlIncludes: "sinn-105-series-introducing",
    records: [
      { brand: "Sinn", model: "105 St Sa", lugToLugMm: 47.4, caseMm: 41, thicknessMm: 11.9, lugWidthMm: 20 },
      { brand: "Sinn", model: "105 St Sa W", lugToLugMm: 47.4, caseMm: 41, thicknessMm: 11.9, lugWidthMm: 20 },
      { brand: "Sinn", model: "105 St Sa UTC", lugToLugMm: 47.4, caseMm: 41, thicknessMm: 11.9, lugWidthMm: 20 },
      { brand: "Sinn", model: "105 St Sa UTC W", lugToLugMm: 47.4, caseMm: 41, thicknessMm: 11.9, lugWidthMm: 20 }
    ]
  },
  {
    urlIncludes: "tag-heuer-refreshes-the-aquaracer-professional-300",
    records: [
      { brand: "TAG Heuer", model: "Aquaracer Professional 300 Date", lugToLugMm: 48, caseMm: 42, thicknessMm: 12 },
      { brand: "TAG Heuer", model: "Aquaracer Professional 300 GMT", lugToLugMm: 48, caseMm: 42, thicknessMm: 13.45 }
    ]
  },
  {
    urlIncludes: "the-black-bay-58-gmt",
    records: [{ brand: "Tudor", model: "Black Bay 58 GMT", reference: "M7939G1A0NRU-0001", lugToLugMm: 47.8, caseMm: 39, thicknessMm: 12.8, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-next-generation-of-seikos-prospex-20mas",
    records: ["SPB453", "SPB451", "SPB455"].map((reference) => ({ brand: "Seiko", model: "Prospex 1965 Heritage Diver", reference, lugToLugMm: 46.4, caseMm: 40, thicknessMm: 13 }))
  },
  {
    urlIncludes: "the-longines-spirit-flyback-chronograph-now-in-titanium",
    records: [{ brand: "Longines", model: "Spirit Flyback Titanium", reference: "L3.821.1.53.6", lugToLugMm: 49, caseMm: 42, thicknessMm: 17 }]
  },
  {
    urlIncludes: "richard-mille-rm-72-01-le-mans-classic",
    records: [{ brand: "Richard Mille", model: "RM 72-01 Le Mans Classic", reference: "RM 72-01", lugToLugMm: 47.34, caseMm: 38.4, thicknessMm: 11.68 }]
  },
  {
    urlIncludes: "tudor-goes-full-less-is-more-with-the-pelagos-39",
    records: [{ brand: "Tudor", model: "Pelagos 39", reference: "M25407N-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.8 }]
  },
  {
    urlIncludes: "patek-philippe-5531r-worldtime-minute-repeater",
    records: [{ brand: "Patek Philippe", model: "World Time Minute Repeater", reference: "5531R", lugToLugMm: 47.35, caseMm: 42, thicknessMm: 11.49 }]
  },
  {
    urlIncludes: "the-new-reverso-tribute-duoface-tourbillon",
    records: [{ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Duoface Tourbillon", reference: "Q392242J", lugToLugMm: 45.5, caseMm: 27.4, thicknessMm: 9.15 }]
  }
];

const semanticRecords = (...records) => records.map((record) => ({ ...record, semantic: true }));

// HODINKEE also publishes the wrist-spanning dimension as case length,
// top-to-bottom, end-to-end, or as the long side of a shaped case. These
// articles were reviewed separately because "height" commonly means case
// thickness in watch writing. Only unambiguous planar dimensions are kept.
const reviewedIndirectDefinitions = [
  {
    urlIncludes: "apple-watch-series-4-review",
    records: semanticRecords(
      { brand: "Apple", model: "Watch Series 4 44mm", reference: "Watch Series 4 44mm", lugToLugMm: 44, caseMm: 38, thicknessMm: 10.7 },
      { brand: "Apple", model: "Watch Series 4 40mm", reference: "Watch Series 4 40mm", lugToLugMm: 40, caseMm: 34, thicknessMm: 10.7 }
    )
  },
  {
    urlIncludes: "a-mechanical-watch-fanatic-reviews-the-apple-watch-ultra",
    records: semanticRecords({ brand: "Apple", model: "Watch Ultra (1st generation)", reference: "Watch Ultra (1st generation)", lugToLugMm: 49, caseMm: 46, thicknessMm: 14.4 })
  },
  {
    urlIncludes: "arpal-one-laurent-ferrier-urwerk-only-watch-2017",
    records: semanticRecords({ brand: "Laurent Ferrier x Urwerk", model: "Arpal One", reference: "Arpal One", lugToLugMm: 60.8, caseMm: 40.9, thicknessMm: 20.7 })
  },
  {
    urlIncludes: "a-collectors-guide-to-vintage-1970s-cartier-watches",
    records: semanticRecords({ brand: "Cartier", model: "Tank Automatique Jumbo", reference: "17002", lugToLugMm: 35, caseMm: 28 })
  },
  {
    urlIncludes: "a-collectors-guide-to-weird-and-wonderful-wooden-dials",
    records: semanticRecords({ brand: "Rolex", model: "Cellini Rectangular Wood Dial", reference: "4127", lugToLugMm: 33, caseMm: 24 })
  },
  {
    urlIncludes: "a-new-cartier-tank-cintree-limited-edition-in-platinum-live-pics",
    records: semanticRecords({ brand: "Cartier", model: "Tank Cintrée Les Rééditions Platinum", reference: "Tank Cintrée Les Rééditions Platinum 2023", lugToLugMm: 46, caseMm: 23, thicknessMm: 6.03 })
  },
  {
    urlIncludes: "cartier-tank-cintree-2018-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Cintrée Pink Gold 2018", reference: "WGTA0025", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 },
      { brand: "Cartier", model: "Tank Cintrée Yellow Gold 2018", reference: "WGTA0026", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 },
      { brand: "Cartier", model: "Tank Cintrée Platinum 2018", reference: "WGTA0027", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 }
    )
  },
  ...[
    "cartier-drive-extra-flat-stainless-steel-yellow-gold-introducing",
    "cartier-drive-de-cartier-extra-flat-stainless-steel-yellow-gold-hands-on"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords(
      { brand: "Cartier", model: "Drive de Cartier Extra-Flat Steel", reference: "Drive Extra-Flat Steel 2018", lugToLugMm: 38, caseMm: 39, thicknessMm: 6.6 },
      { brand: "Cartier", model: "Drive de Cartier Extra-Flat Yellow Gold", reference: "Drive Extra-Flat Yellow Gold 2018", lugToLugMm: 38, caseMm: 39, thicknessMm: 6.6 }
    )
  })),
  {
    urlEquals: "https://www.hodinkee.com/articles/cartier-tank-cintree-hands-on",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Cintrée Pink Gold 2018", reference: "WGTA0025", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 },
      { brand: "Cartier", model: "Tank Cintrée Yellow Gold 2018", reference: "WGTA0026", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 },
      { brand: "Cartier", model: "Tank Cintrée Platinum 2018", reference: "WGTA0027", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.2 }
    )
  },
  ...[
    "cartier-tank-cintree-skeleton-introducing",
    "cartier-tank-cintree-skeleton-hands-on"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Cintrée Skeleton Rose Gold", reference: "Tank Cintrée Skeleton Rose Gold 2017", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.96 },
      { brand: "Cartier", model: "Tank Cintrée Skeleton Platinum", reference: "Tank Cintrée Skeleton Platinum 2017", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 7.96 }
    )
  })),
  {
    urlIncludes: "cartier-brings-back-the-tortue-monopusher-chronograph-and-all",
    records: semanticRecords(
      { brand: "Cartier", model: "Privé Tortue Time-Only 2024", reference: "Privé Tortue Time-Only 2024", lugToLugMm: 41.4, caseMm: 32.9 },
      { brand: "Cartier", model: "Privé Tortue Monopusher Chronograph 2024", reference: "Privé Tortue Monopusher Chronograph 2024", lugToLugMm: 43.7, caseMm: 34.8, thicknessMm: 10.2 }
    )
  },
  {
    urlIncludes: "cartier-releases-the-tressage-a-panthere-bangle",
    records: semanticRecords({ brand: "Cartier", model: "Tressage", reference: "Tressage 2025", lugToLugMm: 56.2, caseMm: 25.7, thicknessMm: 11.5 })
  },
  {
    urlIncludes: "bring-a-loupe-10-18-2024",
    records: semanticRecords({ brand: "Patek Philippe", model: "Square Borgel Case", reference: "1485", lugToLugMm: 35, caseMm: 26 })
  },
  {
    urlIncludes: "bring-a-loupe-april-12-2019",
    records: semanticRecords({ brand: "Longines", model: "Vintage Tank-Style Watch (auction example)", reference: "Vintage Tank-Style Auction Example 2019", lugToLugMm: 37, caseMm: 20 })
  },
  {
    urlIncludes: "bring-a-loupe-february-7-2025",
    records: semanticRecords({ brand: "Patek Philippe", model: "Square Borgel Case", reference: "1486", lugToLugMm: 37, caseMm: 27 })
  },
  {
    urlIncludes: "bring-a-loupe-january-31-2025",
    records: semanticRecords({ brand: "Boucheron", model: "Vintage Gondole (auction example)", reference: "Vintage Gondole Auction Example 2025", lugToLugMm: 28, caseMm: 30 })
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/bring-a-loupe-may-1",
    records: semanticRecords(
      { brand: "Patek Philippe", model: "Hour Glass", reference: "1593", lugToLugMm: 32, caseMm: 22 },
      { brand: "Audemars Piguet", model: "Royal Oak Square", reference: "6005", lugToLugMm: 30, caseMm: 28.5 }
    )
  },
  {
    urlIncludes: "eight-sleeper-picks-phillips-geneva-watch-auction-xi",
    records: semanticRecords({ brand: "Cartier", model: "Tank Asymétrique CPCP", reference: "Tank Asymétrique CPCP 1996", lugToLugMm: 33, caseMm: 23 })
  },
  {
    urlIncludes: "five-crazy-rare-watches-heritage-auctions-october-2018",
    records: semanticRecords({ brand: "Cartier", model: "Tank Mécanique Platinum", reference: "Tank Mécanique Platinum Auction Example 2018", lugToLugMm: 30, caseMm: 23.5 })
  },
  {
    urlIncludes: "cartier-prive-tonneau-xl-skeleton-dual-time-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Privé Tonneau XL Skeleton Dual Time", reference: "Privé Tonneau XL Skeleton Dual Time", lugToLugMm: 52.4, caseMm: 29.8 })
  },
  {
    urlIncludes: "cwc-mellor-72-hands-on",
    records: semanticRecords({ brand: "CWC", model: "Mellor-72", reference: "Mellor-72", lugToLugMm: 42, caseMm: 35, lugWidthMm: 18.5, approximate: true })
  },
  {
    urlIncludes: "dominique-renaud-pulse60-balancier-ultra-amplitude",
    records: semanticRecords({ brand: "Dominique Renaud", model: "Pulse60", reference: "Pulse60", lugToLugMm: 44, caseMm: 40, thicknessMm: 12 })
  },
  {
    urlIncludes: "hands-on-cartier-santos-dumont-rewind",
    records: semanticRecords({ brand: "Cartier", model: "Santos-Dumont Rewind", reference: "WGSA0102", lugToLugMm: 43.5, caseMm: 31.4, thicknessMm: 7.3 })
  },
  {
    urlIncludes: "hands-on-voultainen-28mpr-kv21",
    records: semanticRecords({ brand: "Voutilainen", model: "KV21 Tonneau", reference: "KV21 Tonneau", lugToLugMm: 39.5, caseMm: 35, thicknessMm: 11.66 })
  },
  {
    urlIncludes: "head-to-head-with-two-vintage-inspired-watches-from-brew",
    records: semanticRecords({ brand: "Brew", model: "Metric", reference: "Metric", lugToLugMm: 41.5, caseMm: 36, thicknessMm: 10.75 })
  },
  {
    urlIncludes: "introducing-new-brew-metric-automatic",
    records: semanticRecords({ brand: "Brew", model: "Metric Automatic", reference: "Metric Automatic", lugToLugMm: 41.5, caseMm: 36, thicknessMm: 10.75 })
  },
  {
    urlIncludes: "patek-philippe-golden-ellipse-5738r-introducing",
    records: semanticRecords({ brand: "Patek Philippe", model: "Golden Ellipse Rose Gold", reference: "5738R", lugToLugMm: 39.5, caseMm: 34.5, thicknessMm: 5.9 })
  },
  {
    urlIncludes: "rado-hyperchrome-tradition-captain-cook-mk-ii-hands-on",
    records: semanticRecords({ brand: "Rado", model: "HyperChrome Tradition Captain Cook MK II", reference: "Captain Cook MK II", lugToLugMm: 40, caseMm: 37, lugWidthMm: 18 })
  },
  {
    urlIncludes: "introducing-richard-mille-72-01-charles-leclerc",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 72-01 Charles Leclerc", reference: "RM 72-01 Charles Leclerc", lugToLugMm: 47.34, caseMm: 38.4, thicknessMm: 11.68 })
  },
  {
    urlIncludes: "richard-mille-rm-50-03-tourbillon-split-seconds-chronograph-ultralight-mclaren-f1-introducing",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 50-03 Tourbillon Split-Seconds Chronograph Ultralight McLaren F1", reference: "RM 50-03", lugToLugMm: 49.65, caseMm: 44.5, thicknessMm: 16.1 })
  },
  {
    urlIncludes: "talking-watches-yoshihide-isogai",
    records: semanticRecords({ brand: "Svend Andersen", model: "Smallest Calendar Watch Unique Piece", reference: "Smallest Calendar Watch Unique Piece", lugToLugMm: 24, caseMm: 10, thicknessMm: 7.5 })
  },
  {
    urlIncludes: "the-cartier-tank-that-belonged-to-jacqueline-kennedy-onassis",
    records: semanticRecords({ brand: "Cartier", model: "Tank of Jacqueline Kennedy Onassis", reference: "Jacqueline Kennedy Onassis Tank", lugToLugMm: 28, caseMm: 20 })
  },
  {
    urlIncludes: "the-dollar250k-urwerk-inspired-by-a-vintage-bugatti-and-chicken-grills",
    records: semanticRecords({ brand: "Urwerk", model: "UR-112 Aggregat", reference: "UR-112 Aggregat", lugToLugMm: 52, caseMm: 42, thicknessMm: 16 })
  },
  {
    urlIncludes: "the-gerald-charles-masterlink-perpetual-calendar",
    records: semanticRecords({ brand: "Gérald Charles", model: "Masterlink Perpetual Calendar", reference: "Masterlink Perpetual Calendar", lugToLugMm: 40, caseMm: 40, thicknessMm: 10 })
  },
  {
    urlIncludes: "the-ianos-avyssos",
    records: semanticRecords({ brand: "Ianos", model: "Avyssos", reference: "Avyssos", lugToLugMm: 54, caseMm: 44 })
  },
  {
    urlIncludes: "windows-on-time-cartier-and-louis-vuitton-spearhead-a-new-era",
    records: semanticRecords({ brand: "Audemars Piguet", model: "John Schaeffer Minute Repeater Jump Hour", reference: "25798", lugToLugMm: 40, caseMm: 33 })
  },
  {
    urlIncludes: "cartier-libre-collection-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Baignoire Infinie", reference: "Baignoire Infinie 2018", lugToLugMm: 50, caseMm: 38.2 },
      { brand: "Cartier", model: "Baignoire Étoilée", reference: "Baignoire Étoilée 2018", lugToLugMm: 20.11, caseMm: 43.65 },
      { brand: "Cartier", model: "Baignoire Interdite", reference: "Baignoire Interdite 2018", lugToLugMm: 21.4, caseMm: 35.35 },
      { brand: "Cartier", model: "Crash Radieuse", reference: "Crash Radieuse 2018", lugToLugMm: 42, caseMm: 23.3 }
    )
  },
  {
    urlIncludes: "bring-a-loupe-february-28-2025",
    records: semanticRecords({ brand: "Anonymous", model: "1970s Silver Tank Cintrée-Style Watch", reference: "1970s Silver Tank Cintrée-Style Auction Example", lugToLugMm: 43, caseMm: 18 })
  },
  {
    urlIncludes: "bring-a-loupe-march-21-2025",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "Rectangular Malachite Dial", reference: "2077", lugToLugMm: 38, caseMm: 29 })
  },
  {
    urlIncludes: "our-favorite-lots-from-this-weekends-monaco-legend-auction",
    records: semanticRecords({ brand: "Audemars Piguet", model: "Rectangular Calendar Moonphase", reference: "5514BA", lugToLugMm: 24, caseMm: 24 })
  },
  {
    urlIncludes: "casio-edifice-eqb-600-smartphone-link-3d-global-dial",
    records: semanticRecords({ brand: "Casio", model: "Edifice EQB-600 Smartphone Link", reference: "EQB-600", lugToLugMm: 51.9, caseMm: 47.3, thicknessMm: 13.3 })
  },
  {
    urlIncludes: "g-shock-gmb2100-full-metal-casioak-2022",
    records: semanticRecords(
      { brand: "Casio", model: "G-SHOCK Full Metal CasiOak", reference: "GM-B2100D-1A", lugToLugMm: 49.8, caseMm: 44.4, thicknessMm: 12.8 },
      { brand: "Casio", model: "G-SHOCK Full Metal CasiOak Copper IP", reference: "GM-B2100GD-5A", lugToLugMm: 49.8, caseMm: 44.4, thicknessMm: 12.8 },
      { brand: "Casio", model: "G-SHOCK Full Metal CasiOak Black IP", reference: "GM-B2100BD-1A", lugToLugMm: 49.8, caseMm: 44.4, thicknessMm: 12.8 }
    )
  },
  {
    urlIncludes: "christophe-claret-maestro-hands-on",
    records: semanticRecords({ brand: "Christophe Claret", model: "X-TREM-1", reference: "X-TREM-1", lugToLugMm: 56.8, caseMm: 40.8, thicknessMm: 15, noteSuffix: "The article supplies this dimension for the X-TREM-1 as a comparison watch." })
  },
  {
    urlIncludes: "eight-best-watches-2016-that-you-probably-forgot-about",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 67-01 Automatic Extra Flat", reference: "RM 67-01", lugToLugMm: 47.52, caseMm: 38.7, thicknessMm: 7.75 })
  },
  {
    urlIncludes: "fiona-kruger-mechanical-entropy-introducing",
    records: semanticRecords({ brand: "Fiona Krüger", model: "Mechanical Entropy", reference: "Mechanical Entropy", lugToLugMm: 48, caseMm: 40, thicknessMm: 7.5 })
  },
  {
    urlIncludes: "fp-journe-vagabondage-2022-gold",
    records: semanticRecords({ brand: "F.P. Journe", model: "Vagabondage 2022 Gold", reference: "Vagabondage 2022 Gold", lugToLugMm: 45.2, caseMm: 37.5, thicknessMm: 7.6 })
  },
  {
    urlIncludes: "girard-perregaux-cats-eye-tourbilllon-diamonds",
    records: semanticRecords({ brand: "Girard-Perregaux", model: "Cat's Eye Tourbillon With Gold Bridge", reference: "Cat's Eye Tourbillon With Gold Bridge", lugToLugMm: 38.4, caseMm: 32.9, thicknessMm: 12.7 })
  },
  ...[
    "hands-on-audemars-piguet-rd5",
    "the-5-story-of-25-a-technical-and-practical-deep-dive-on-the-audemars-piguet-royal-oak-rd5"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Audemars Piguet", model: "Royal Oak RD#5", reference: "26545XT", lugToLugMm: 49, caseMm: 39, thicknessMm: 8.1, approximate: true })
  })),
  {
    urlIncludes: "harry-winston-histoire-de-tourbillon-10-introducing",
    records: semanticRecords({ brand: "Harry Winston", model: "Histoire de Tourbillon 10", reference: "Histoire de Tourbillon 10", lugToLugMm: 53.3, caseMm: 39.1, thicknessMm: 17.6 })
  },
  {
    urlIncludes: "indiana-jones-first-watch-harrison-ford-wears-a-vintage-inspired-hamilton",
    records: semanticRecords({ brand: "Hamilton", model: "Boulton Quartz Indiana Jones", reference: "H13431553", lugToLugMm: 31.6, caseMm: 27 })
  },
  {
    urlIncludes: "intergalactic-design-from-rado-and-patek-philippe",
    records: semanticRecords(
      { brand: "Rado", model: "DiaStar Original 60-Year Anniversary Edition", reference: "R12160103", lugToLugMm: 45, caseMm: 38, thicknessMm: 12 },
      { brand: "Patek Philippe", model: "Back-Wind Oval", reference: "3580", lugToLugMm: 40.3, caseMm: 35.4 }
    )
  },
  {
    urlIncludes: "intro-longines-mini-dolcevita-goes-gold",
    records: semanticRecords({ brand: "Longines", model: "Mini DolceVita Gold 2024", reference: "Mini DolceVita Gold 2024", lugToLugMm: 29, caseMm: 21.5, thicknessMm: 6.75 })
  },
  {
    urlIncludes: "longines-expands-its-bite-sized-mini-dolcevita-line-with-new-revamped-double-strap-design",
    records: semanticRecords({ brand: "Longines", model: "Mini DolceVita Double Strap 2025", reference: "Mini DolceVita Double Strap 2025", lugToLugMm: 29, caseMm: 21.5, thicknessMm: 6.75 })
  },
  {
    urlIncludes: "intro-richard-mille-tourbillion-soccer",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 41-01 Tourbillon Soccer", reference: "RM 41-01", lugToLugMm: 49.65, caseMm: 43.24, thicknessMm: 16.08 })
  },
  {
    urlIncludes: "introducing-daniel-roth-extra-plat-rose-gold",
    records: semanticRecords({ brand: "Daniel Roth", model: "Extra Plat Rose Gold", reference: "DBBD01A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 7.7, lugWidthMm: 20 })
  },
  {
    urlIncludes: "introducing-dennison-collectability-limited-edition",
    records: semanticRecords({ brand: "Dennison", model: "Collectability Sunray Dial Limited Edition", reference: "Collectability Sunray Dial Limited Edition", lugToLugMm: 37, caseMm: 33.65, thicknessMm: 6.05, lugWidthMm: 20 })
  },
  {
    urlIncludes: "introducing-girard-perregaux-deep-diver",
    records: semanticRecords({ brand: "Girard-Perregaux x Bamford", model: "Deep Diver", reference: "39500-21-3266-6CX", lugToLugMm: 40.3, caseMm: 38, thicknessMm: 13.91 })
  },
  {
    urlIncludes: "introducing-russias-konstantin-chaykin-cinema-watch",
    records: semanticRecords({ brand: "Konstantin Chaykin", model: "Cinema", reference: "Cinema", lugToLugMm: 47, caseMm: 37, thicknessMm: 12.2 })
  },
  {
    urlIncludes: "introducing-the-cartier-crash-skeleton",
    records: semanticRecords({ brand: "Cartier", model: "Crash Skeleton Platinum", reference: "Crash Skeleton Platinum", lugToLugMm: 45, caseMm: 28 })
  },
  {
    urlIncludes: "introducing-the-jeanrichard-diverscope-lpr",
    records: semanticRecords({ brand: "JeanRichard", model: "Diverscope LPR", reference: "Diverscope LPR", lugToLugMm: 43, caseMm: 43 })
  },
  {
    urlIncludes: "introducing-timetide-x-dennison-datenight",
    records: semanticRecords({ brand: "Dennison x Time+Tide", model: "DateNight", reference: "DateNight", lugToLugMm: 37, caseMm: 33.5, thicknessMm: 6.05 })
  },
  {
    urlIncludes: "its-here-daniel-roth-has-been-revived-with-the-new-tourbillon-souscription",
    records: semanticRecords({ brand: "Daniel Roth", model: "Tourbillon Souscription", reference: "DR0011YG-01", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 9.2 })
  },
  {
    urlIncludes: "larsson-jennings-first-mechanical-watch-collections-introducing",
    records: semanticRecords(
      { brand: "Larsson & Jennings", model: "Norse 27", reference: "Norse 27", lugToLugMm: 34, caseMm: 27 },
      { brand: "Larsson & Jennings", model: "Norse 29", reference: "Norse 29", lugToLugMm: 40, caseMm: 29 },
      { brand: "Larsson & Jennings", model: "Norse Mechanical", reference: "Norse Mechanical", lugToLugMm: 42, caseMm: 31 }
    )
  },
  {
    urlIncludes: "noah-unveils-the-follow-up-to-its-hit-timex-collaboration-watch",
    records: semanticRecords({ brand: "Noah x Timex", model: "Moonphase Watch", reference: "Noah x Timex Moonphase Watch", lugToLugMm: 37, caseMm: 25 })
  },
  {
    urlIncludes: "the-noah-x-timex-sun-and-moon-watch",
    records: semanticRecords({ brand: "Noah x Timex", model: "Sun And Moon Watch", reference: "Noah x Timex Sun And Moon Watch", lugToLugMm: 37, caseMm: 25 })
  },
  {
    urlIncludes: "patek-philippe-5940g",
    records: semanticRecords({ brand: "Patek Philippe", model: "Perpetual Calendar Cushion", reference: "5940G", lugToLugMm: 44.6, caseMm: 37, thicknessMm: 8.6 })
  },
  {
    urlIncludes: "richard-mille-keeps-making-right-with-the-womens-rm-07-01",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 07-01 Coloured Ceramics", reference: "RM 07-01 Coloured Ceramics", lugToLugMm: 45.23, caseMm: 31.4, thicknessMm: 11.85 })
  },
  {
    urlIncludes: "seiko-presage-enamel-collection-introducing",
    records: semanticRecords({ brand: "Seiko", model: "Presage Enamel Tonneau", reference: "SPB049", lugToLugMm: 46, caseMm: 35.9, thicknessMm: 12.5 })
  },
  {
    urlIncludes: "squaring-the-circle",
    records: semanticRecords({ brand: "Apple", model: "Watch Series 3 Edition 42mm", reference: "Watch Series 3 Edition 42mm", lugToLugMm: 42.6, caseMm: 36.5 })
  },
  ...[
    "the-2-story-of-22-debating-the-best-sport-watch-of-the-90s-video",
    "three-on-three-rolex-seiko-omega-90s-icons"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Seiko", model: "SKX007", reference: "SKX007", lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.3 })
  })),
  {
    urlIncludes: "the-cartier-mini-tank-keeps-small-watch-fever-burning",
    records: semanticRecords({ brand: "Cartier", model: "Tank Louis Cartier Mini", reference: "WGTA0352", lugToLugMm: 24, caseMm: 16.5, thicknessMm: 6.2 })
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/the-cartier-tank-americaine",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Américaine Large (reviewed generation)", reference: "Tank Américaine Large Reviewed Generation", lugToLugMm: 44.4, caseMm: 24.4 },
      { brand: "Cartier", model: "Tank Américaine Small (reviewed generation)", reference: "Tank Américaine Small Reviewed Generation", lugToLugMm: 35, caseMm: 19 },
      { brand: "Cartier", model: "Tank Américaine Mini (reviewed generation)", reference: "Tank Américaine Mini Reviewed Generation", lugToLugMm: 28, caseMm: 15.2 }
    )
  },
  {
    urlIncludes: "the-chanel-boyfriend-red-x-ray-red-skeleton",
    records: semanticRecords({ brand: "Chanel", model: "Boy.Friend Skeleton X-Ray Red Edition", reference: "Boy.Friend Skeleton X-Ray Red Edition", lugToLugMm: 37, caseMm: 28.6, thicknessMm: 8.4 })
  },
  {
    urlIncludes: "the-golden-ellipse-is-back-on-bracelet",
    records: semanticRecords({ brand: "Patek Philippe", model: "Golden Ellipse On Bracelet", reference: "5738/1R-001", lugToLugMm: 39.5, caseMm: 34.5, thicknessMm: 5.9 })
  },
  {
    urlIncludes: "introducing-the-hermes-dressage-wristwatch-with-a-brand-new",
    records: semanticRecords({ brand: "Hermès", model: "Dressage H1837", reference: "Dressage H1837", lugToLugMm: 40.5, caseMm: 38.4 })
  },
  {
    urlIncludes: "the-jaeger-lecoultre-tribute-reverso-duo",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Tribute Reverso Duo", reference: "Tribute Reverso Duo", lugToLugMm: 42.8, caseMm: 25.5 })
  },
  {
    urlIncludes: "the-new-swatch-bioceramic-what-if-collection",
    records: semanticRecords({ brand: "Swatch", model: "Bioceramic What If? Collection", reference: "Bioceramic What If? Collection", lugToLugMm: 33, caseMm: 33 })
  },
  {
    urlIncludes: "swatch-what-iftariffs-a-bioceramic-take-on-a-watch-you-can-only-buy-in-switzerland",
    records: semanticRecords({ brand: "Swatch", model: "What If…Tariffs?", reference: "What If…Tariffs?", lugToLugMm: 33, caseMm: 33 })
  },
  {
    urlIncludes: "the-noah-x-timex-lighthouse-watch-live-pics",
    records: semanticRecords({ brand: "Noah x Timex", model: "Lighthouse Watch", reference: "Noah x Timex Lighthouse Watch", lugToLugMm: 35, caseMm: 31 })
  },
  {
    urlIncludes: "the-parmigiani-fleurier-ovale-tourbillon",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Ovale Tourbillon", reference: "Ovale Tourbillon", lugToLugMm: 45, caseMm: 37.3 })
  },
  {
    urlIncludes: "one-cartier-two-cartier-red-cartier-blue-cartier",
    records: semanticRecords({
      brand: "Cartier",
      model: "Tank Must Monochrome Large",
      reference: "Tank Must Monochrome Large 2021",
      lugToLugMm: 33.7,
      caseMm: 25,
      noteSuffix: "The dimensions apply to the burgundy, blue, and green large-size Tank Must Monochrome models reviewed together."
    })
  },
  {
    urlIncludes: "unearthing-a-forgotten-bvlgari-by-gerald-genta",
    records: semanticRecords({
      brand: "Bvlgari",
      model: "1970s Time-Only Gerald Genta Commission",
      reference: "1970s Time-Only Gerald Genta Commission",
      lugToLugMm: 25,
      caseMm: 35,
      lugWidthMm: 22,
      noteSuffix: "Hodinkee describes this rare, apparently uncatalogued time-only example as 35mm wide by 25mm tall."
    })
  },
  {
    urlIncludes: "anoma-watches-unveils-the-shape-shiftingly-retro-a1",
    records: semanticRecords({ brand: "Anoma", model: "A1", reference: "A1", lugToLugMm: 39, caseMm: 38, thicknessMm: 9.45 })
  },
  {
    urlIncludes: "introducing-the-anoma-a1-optical",
    records: semanticRecords({ brand: "Anoma", model: "A1 Optical", reference: "A1 Optical", lugToLugMm: 39, caseMm: 38, thicknessMm: 9.45 })
  },
  {
    urlIncludes: "the-anoma-a1-prehistoric",
    records: semanticRecords({ brand: "Anoma", model: "A1 Prehistoric", reference: "A1 Prehistoric", lugToLugMm: 39, caseMm: 38, thicknessMm: 9.45 })
  },
  {
    urlIncludes: "baume-and-mercier-hampton-automatic-introducing",
    records: semanticRecords(
      { brand: "Baume & Mercier", model: "Hampton Automatic", reference: "M0A10522", lugToLugMm: 43, caseMm: 27.5, thicknessMm: 10 },
      { brand: "Baume & Mercier", model: "Hampton Automatic", reference: "M0A10528", lugToLugMm: 48, caseMm: 31, thicknessMm: 9.35 }
    )
  },
  {
    urlIncludes: "breguet-reine-de-naples-8918-in-grand-feu-enamel-introducing",
    records: semanticRecords({ brand: "Breguet", model: "Reine de Naples Grand Feu Enamel", reference: "8918BB/28/964 D00D", lugToLugMm: 36.5, caseMm: 28.45, thicknessMm: 10.5 })
  },
  {
    urlIncludes: "cartier-maillon-de-cartier-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Maillon de Cartier", reference: "Maillon de Cartier 2020", lugToLugMm: 17, caseMm: 16, thicknessMm: 6.8 })
  },
  {
    urlIncludes: "cartier-prive-collection-tank-asymmetrique-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Privé Tank Asymétrique", reference: "Privé Tank Asymétrique 2020", lugToLugMm: 47.15, caseMm: 26.2, thicknessMm: 6.38 })
  },
  {
    urlIncludes: "cartier-tank-asymmetrique-skeleton-prive-collection-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Privé Tank Asymétrique Skeleton", reference: "Privé Tank Asymétrique Skeleton 2020", lugToLugMm: 47.15, caseMm: 26.2, thicknessMm: 7.82 })
  },
  {
    urlIncludes: "cartier-santos-chronograph-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Santos Chronograph Extra-Large", reference: "Santos Chronograph Extra-Large 2019", lugToLugMm: 51.3, caseMm: 43.3, thicknessMm: 12.5 })
  },
  {
    urlIncludes: "cartier-santos-collection-2018-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Santos Medium 2018 Collection", reference: "Santos Medium 2018 Collection", lugToLugMm: 41.9, caseMm: 35.1, thicknessMm: 8.83 },
      { brand: "Cartier", model: "Santos Large 2018 Collection", reference: "Santos Large 2018 Collection", lugToLugMm: 47.5, caseMm: 39.8, thicknessMm: 9.08 }
    )
  },
  {
    urlIncludes: "cartier-santos-dumont-la-demoiselle-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Santos-Dumont La Demoiselle", reference: "Santos-Dumont La Demoiselle 2020", lugToLugMm: 46.6, caseMm: 33.9, thicknessMm: 7.5 })
  },
  {
    urlIncludes: "cartier-santos-dumont-le-bresil-la-baladeuse-no14-bis-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Santos-Dumont Le Brésil", reference: "WGSA0034", lugToLugMm: 43.5, caseMm: 31.4, thicknessMm: 7.3 },
      { brand: "Cartier", model: "Santos-Dumont La Baladeuse", reference: "WGSA0027", lugToLugMm: 43.5, caseMm: 31.4, thicknessMm: 7.3 },
      { brand: "Cartier", model: "Santos-Dumont No. 14 Bis", reference: "Santos-Dumont No. 14 Bis 2020", lugToLugMm: 43.5, caseMm: 31.4, thicknessMm: 7.3 }
    )
  },
  {
    urlIncludes: "cartier-santos-dumont-xl-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Santos-Dumont XL Hand-Wind", reference: "Santos-Dumont XL Hand-Wind 2020", lugToLugMm: 46.6, caseMm: 33.9, thicknessMm: 7.5 })
  },
  {
    urlIncludes: "the-cartier-santos-dumont-xl-in-three-precious-metals",
    records: semanticRecords(
      { brand: "Cartier", model: "Santos-Dumont XL Precious-Metal Limited Models", reference: "Santos-Dumont XL Precious-Metal Limited Models", lugToLugMm: 46.6, caseMm: 33.9 },
      { brand: "Cartier", model: "Santos-Dumont Large Precious-Metal Models", reference: "Santos-Dumont Large Precious-Metal Models", lugToLugMm: 43.5, caseMm: 31.4 }
    )
  },
  {
    urlIncludes: "four-new-tank-louis-cartier-watches",
    records: semanticRecords({ brand: "Cartier", model: "Tank Louis Cartier Large Four-Dial Collection", reference: "Tank Louis Cartier Large Four-Dial Collection", lugToLugMm: 33.7, caseMm: 25.5, thicknessMm: 6.6 })
  },
  {
    urlIncludes: "introducing-tank-a-guichets-2025",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank à Guichets Yellow Gold", reference: "WGTA0234", lugToLugMm: 37.6, caseMm: 24.8, thicknessMm: 6 },
      { brand: "Cartier", model: "Tank à Guichets Rose Gold", reference: "WGTA0235", lugToLugMm: 37.6, caseMm: 24.8, thicknessMm: 6 },
      { brand: "Cartier", model: "Tank à Guichets Platinum", reference: "WGTA0236", lugToLugMm: 37.6, caseMm: 24.8, thicknessMm: 6 },
      { brand: "Cartier", model: "Tank à Guichets Platinum Limited Edition", reference: "WGTA0237", lugToLugMm: 37.6, caseMm: 24.8, thicknessMm: 6 }
    )
  },
  {
    urlIncludes: "solarbeat-tank-must-the-first-ever-solar-powered-cartier-watch-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Must SolarBeat Large", reference: "Tank Must SolarBeat Large", lugToLugMm: 33, caseMm: 25.5 },
      { brand: "Cartier", model: "Tank Must SolarBeat Small", reference: "Tank Must SolarBeat Small", lugToLugMm: 29.5, caseMm: 22 }
    )
  },
  {
    urlIncludes: "introducing-cartier-roadster",
    records: semanticRecords(
      { brand: "Cartier", model: "Roadster Large", reference: "Roadster Large 2025", lugToLugMm: 47, caseMm: 38, thicknessMm: 10.06 },
      { brand: "Cartier", model: "Roadster Midsize", reference: "Roadster Midsize 2025", lugToLugMm: 42.5, caseMm: 34.9, thicknessMm: 9.7 }
    )
  },
  {
    urlIncludes: "the-new-cartier-tank-americaine",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Américaine Large (reviewed generation)", reference: "Tank Américaine Large Reviewed Generation", lugToLugMm: 44.4, caseMm: 24.4, thicknessMm: 8.6 },
      { brand: "Cartier", model: "Tank Américaine Small (reviewed generation)", reference: "Tank Américaine Small Reviewed Generation", lugToLugMm: 35.4, caseMm: 19.4, thicknessMm: 6.8 },
      { brand: "Cartier", model: "Tank Américaine Mini (reviewed generation)", reference: "Tank Américaine Mini Reviewed Generation", lugToLugMm: 28, caseMm: 15.2, thicknessMm: 6.5 }
    )
  },
  {
    urlIncludes: "the-original-tank-returns-with-the-prive-tank-normale",
    records: semanticRecords(
      { brand: "Cartier", model: "Privé Tank Normale", reference: "Tank Normale", lugToLugMm: 32.6, caseMm: 25.7, thicknessMm: 6.85 },
      { brand: "Cartier", model: "Privé Tank Normale Skeleton", reference: "Privé Tank Normale Skeleton", lugToLugMm: 35.2, caseMm: 27.8, thicknessMm: 8.15 }
    )
  },
  {
    urlIncludes: "chanel-premiere-extrait-de-camelia-introducing",
    records: semanticRecords(
      { brand: "Chanel", model: "Première Extrait de Camélia Black Dial", reference: "H6361", lugToLugMm: 19.7, caseMm: 15.2, thicknessMm: 7.8 },
      { brand: "Chanel", model: "Première Extrait de Camélia Diamond Dial", reference: "H6362", lugToLugMm: 19.7, caseMm: 15.2, thicknessMm: 7.8 }
    )
  },
  {
    urlIncludes: "dennison-collectability-edition-oblique-collection",
    records: semanticRecords({ brand: "Dennison x Collectability", model: "Edition Oblique Collection", reference: "Edition Oblique Collection 2026", lugToLugMm: 35, caseMm: 33.6, thicknessMm: 6.05 })
  },
  {
    urlIncludes: "dennison-throws-some-shades-on-new-ald-dual-time-models",
    records: semanticRecords({ brand: "Dennison", model: "ALD Dual Time Shades", reference: "ALD Dual Time Shades", lugToLugMm: 37, caseMm: 35.6, thicknessMm: 6.1 })
  },
  {
    urlIncludes: "the-piaget-sixtie",
    records: semanticRecords(
      { brand: "Piaget", model: "Sixtie", reference: "G0A50300", lugToLugMm: 25.3, caseMm: 29, thicknessMm: 6.5 },
      { brand: "Piaget", model: "Sixtie", reference: "G0A50301", lugToLugMm: 25.3, caseMm: 29, thicknessMm: 6.5 },
      { brand: "Piaget", model: "Sixtie", reference: "G0A50302", lugToLugMm: 25.3, caseMm: 29, thicknessMm: 6.5 },
      { brand: "Piaget", model: "Sixtie", reference: "G0A50304", lugToLugMm: 25.3, caseMm: 29, thicknessMm: 6.5 }
    )
  },
  {
    urlIncludes: "intro-jlc-reverso-gyrotourbillon-reverso-minute-repeater",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Minute Repeater", reference: "Q7122480", lugToLugMm: 51.1, caseMm: 31, thicknessMm: 12.6 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Hybris Artistica Calibre 179", reference: "Q39434E1", lugToLugMm: 51.1, caseMm: 31, thicknessMm: 13.63 }
    )
  },
  {
    urlIncludes: "intro-reverso-tribute-chronograph-in-pink-gold",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Chronograph Pink Gold", reference: "Q389256J", lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.14 })
  },
  {
    urlIncludes: "jaeger-lecoultre-raids-its-archives-for-a-new-vintage-watch-collection",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "The Collectibles Reverso Small Seconds", reference: "QV020101", lugToLugMm: 39, caseMm: 21 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-metiers-rares-tribute-to-ferdinand-hodler",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Métiers Rares Tribute To Ferdinand Hodler", reference: "Reverso Ferdinand Hodler", lugToLugMm: 45.5, caseMm: 27.4, thicknessMm: 9.73 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-tribute-duoface-fagliano-limited-edition-introducing",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Duoface Fagliano Limited Edition", reference: "Q398256J", lugToLugMm: 47, caseMm: 28.3, thicknessMm: 10.3 })
  },
  {
    urlIncludes: "the-jaeger-lecoultre-reverso-monoface-in-steel-now-back-with-a-smaller-case",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Monoface", reference: "Q7168420", lugToLugMm: 40.1, caseMm: 24.4, thicknessMm: 7.56 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Monoface", reference: "Q716848J", lugToLugMm: 40.1, caseMm: 24.4, thicknessMm: 7.56 }
    )
  },
  {
    urlIncludes: "laurent-ferrier-bridge-one-introducing",
    records: semanticRecords(
      { brand: "Laurent Ferrier", model: "Bridge One", reference: "LCF 032.AC.AG1", lugToLugMm: 44, caseMm: 30, thicknessMm: 14.58 },
      { brand: "Laurent Ferrier", model: "Bridge One", reference: "LCF.032.AC.E01", lugToLugMm: 44, caseMm: 30, thicknessMm: 14.58 }
    )
  },
  {
    urlIncludes: "patek-philippe-has-revived-the-golden-ellipse-in-its-traditional-proportions",
    records: semanticRecords(
      { brand: "Patek Philippe", model: "Golden Ellipse Jumbo White Gold", reference: "5738G-001", lugToLugMm: 39.5, caseMm: 34.5, thicknessMm: 5.99 },
      { brand: "Patek Philippe", model: "Golden Ellipse Medium White Gold", reference: "3738G/100G-014", lugToLugMm: 35.6, caseMm: 31.1, thicknessMm: 5.99 }
    )
  },
  {
    urlIncludes: "parmigiani-fleurier-kalpa-chronor-introducing",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Kalpa Chronor", reference: "187-1001400-HA1442", lugToLugMm: 48.2, caseMm: 40.4, thicknessMm: 14 })
  },
  {
    urlIncludes: "parmigiani-fleurier-kalpa-hebdomadaire-introducing",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Kalpa Hebdomadaire", reference: "101-1001400-HA1441", lugToLugMm: 42.3, caseMm: 32.1, thicknessMm: 11.4 })
  },
  {
    urlIncludes: "parmigiani-fleurier-kalpagraphe-chronometre-introducing",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Kalpagraphe Chronomètre", reference: "193-1002500-HA3242", lugToLugMm: 39.8, caseMm: 31.9, thicknessMm: 14 })
  },
  {
    urlIncludes: "parmigiani-fleurier-type-390-bugatti-sport-introducing",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Bugatti Type 390", reference: "Bugatti Type 390", lugToLugMm: 57.7, caseMm: 42.2, thicknessMm: 18.4 })
  },
  {
    urlIncludes: "intro-daniel-roth-extra-plat-souscription",
    records: semanticRecords({ brand: "Daniel Roth", model: "Extra Plat Souscription", reference: "DBBE01A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 7.7 })
  },
  {
    urlIncludes: "intro-daniel-roth-tourbillon-in-rose-gold",
    records: semanticRecords({ brand: "Daniel Roth", model: "Tourbillon Rose Gold", reference: "DAAD01A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 9.2 })
  },
  {
    urlIncludes: "introducing-daniel-roth-skeleton",
    records: semanticRecords({ brand: "Daniel Roth", model: "Extra-Plat Skeleton", reference: "DBBD02A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 6.9 })
  },
  {
    urlIncludes: "g-shock-throws-it-back-to-the-original-rubber-ball-prototype-with-the-new-ga-v01",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK GA-V01", reference: "GA-V01", lugToLugMm: 58.2, caseMm: 49.1, thicknessMm: 19.6 })
  },
  {
    urlIncludes: "introducing-g-shock-nasa-five",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK NASA V", reference: "GW6900NASA241", lugToLugMm: 53.2, caseMm: 50, thicknessMm: 17.7 })
  },
  {
    urlIncludes: "its-the-baby-g-x-hello-kitty-double-anniversary-spectacular",
    records: semanticRecords({ brand: "Casio", model: "Baby-G x Hello Kitty", reference: "BGD565KT-7", lugToLugMm: 42.1, caseMm: 37.9, thicknessMm: 11.3 })
  },
  {
    urlIncludes: "the-baby-g-summer-jelly-watch",
    records: semanticRecords(
      { brand: "Casio", model: "Baby-G Summer Jelly", reference: "BGD-565SJ-2", lugToLugMm: 42.1, caseMm: 37.9, thicknessMm: 11.3 },
      { brand: "Casio", model: "Baby-G Summer Jelly", reference: "BGD565SJ-7", lugToLugMm: 42.1, caseMm: 37.9, thicknessMm: 11.3 },
      { brand: "Casio", model: "Baby-G Summer Jelly", reference: "BGD565SJ-9", lugToLugMm: 42.1, caseMm: 37.9, thicknessMm: 11.3 }
    )
  },
  {
    urlIncludes: "h-mosser-swiss-alp-watch-concept-cosmic-green-introducing",
    records: semanticRecords({ brand: "H. Moser & Cie.", model: "Swiss Alp Watch Concept Cosmic Green", reference: "5324-0210", lugToLugMm: 44, caseMm: 38.2, thicknessMm: 10.3 })
  },
  {
    urlIncludes: "hublot-mp-10-tourbillion-weight-energy-system-titanium",
    records: semanticRecords({ brand: "Hublot", model: "MP-10 Tourbillon Weight Energy System Titanium", reference: "910.NX.0001.RX", lugToLugMm: 54, caseMm: 41.5, thicknessMm: 22.4 })
  },
  {
    urlIncludes: "intro-alpina-heritage-carree-and-startimer-pilot-quartz-worldtimer",
    records: semanticRecords({ brand: "Alpina", model: "Alpiner Heritage Carrée Automatic 140 Years", reference: "AL-530SAC3C6", lugToLugMm: 39, caseMm: 32.5, thicknessMm: 9.71 })
  },
  {
    urlIncludes: "intro-hamilton-death-stranding-2",
    records: semanticRecords({ brand: "Hamilton", model: "American Classic Boulton Death Stranding 2", reference: "H13605130", lugToLugMm: 48, caseMm: 36, thicknessMm: 13.7, lugWidthMm: 21 })
  },
  {
    urlIncludes: "introducing-amida-digitrend-open-sapphire",
    records: semanticRecords({ brand: "Amida", model: "Digitrend Open Sapphire", reference: "Digitrend Open Sapphire", lugToLugMm: 39.6, caseMm: 39, thicknessMm: 16 })
  },
  {
    urlIncludes: "introducing-otsuka-lotec-no-9",
    records: semanticRecords({ brand: "Ōtsuka Lōtec", model: "No. 9", reference: "No. 9", lugToLugMm: 41.3, caseMm: 26.4, thicknessMm: 10.35, lugWidthMm: 26 })
  },
  {
    urlIncludes: "introducing-vieren-gold-waves",
    records: semanticRecords({ brand: "Vieren", model: "Gold Waves", reference: "Gold Waves", lugToLugMm: 41, caseMm: 27, thicknessMm: 9.2 })
  },
  ...[
    "introducing-serica-reference-1174-parade",
    "serica-extends-the-parade-with-two-linen-inspired-models"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Serica", model: "Parade", reference: "1174", lugToLugMm: 41, caseMm: 35, thicknessMm: 8.6 })
  })),
  {
    urlIncludes: "rado-tradition-captain-cook-mkiii-automatic-introducing",
    records: semanticRecords({ brand: "Rado", model: "Tradition Captain Cook MKIII Automatic", reference: "764.6030.3.117", lugToLugMm: 48.3, caseMm: 46.8, thicknessMm: 13.9 })
  },
  {
    urlIncludes: "introducing-urwerk-ur-100v-ceramic",
    records: semanticRecords({ brand: "Urwerk", model: "UR-100V LightSpeed Ceramic", reference: "UR-100V LightSpeed Ceramic", lugToLugMm: 51.73, caseMm: 43, thicknessMm: 14.5 })
  },
  {
    urlIncludes: "urwerk-ur-111c-introducing",
    records: semanticRecords({ brand: "Urwerk", model: "UR-111C", reference: "UR-111C", lugToLugMm: 46, caseMm: 42, thicknessMm: 15 })
  },
  {
    urlIncludes: "the-cartier-tortue-is-back-and-as-a-monopusher-chronograph",
    records: semanticRecords(
      { brand: "Cartier", model: "Privé Tortue Time-Only 2024", reference: "Privé Tortue Time-Only 2024", lugToLugMm: 41.4, caseMm: 32.9, thicknessMm: 7.2 },
      { brand: "Cartier", model: "Privé Tortue Monopusher Chronograph 2024", reference: "Privé Tortue Monopusher Chronograph 2024", lugToLugMm: 43.7, caseMm: 34.8, thicknessMm: 10.2 }
    )
  },
  {
    urlIncludes: "intro-mbf-hm9-sapphire-vision-2023",
    records: semanticRecords({ brand: "MB&F", model: "HM9 Sapphire Vision 2023", reference: "HM9 Sapphire Vision 2023", lugToLugMm: 57, caseMm: 47, thicknessMm: 23 })
  },
  {
    urlIncludes: "mbandf-hm9-flow-introducing",
    records: semanticRecords({ brand: "MB&F", model: "HM9 Flow", reference: "HM9 Flow", lugToLugMm: 57, caseMm: 47, thicknessMm: 23 })
  },
  {
    urlIncludes: "mbandf-hm9-flow-red-gold-introducing",
    records: semanticRecords({ brand: "MB&F", model: "HM9 Flow Red Gold", reference: "HM9 Flow Red Gold", lugToLugMm: 57, caseMm: 47, thicknessMm: 23 })
  },
  {
    urlIncludes: "mbandf-moonmachine-2-stepan-sarpaneva-introducing",
    records: semanticRecords({ brand: "MB&F x Stepan Sarpaneva", model: "MoonMachine 2", reference: "MoonMachine 2", lugToLugMm: 51.5, caseMm: 49, thicknessMm: 19.5 })
  },
  {
    urlIncludes: "the-horological-machine-hm10-bulldog-from-mbandf-introducing",
    records: semanticRecords({ brand: "MB&F", model: "HM10 Bulldog", reference: "HM10 Bulldog", lugToLugMm: 54, caseMm: 45, thicknessMm: 24 })
  },
  {
    urlIncludes: "the-jacob-and-co-x-bugatti-chiron-tourbillon-introducing",
    records: semanticRecords({ brand: "Jacob & Co. x Bugatti", model: "Chiron Tourbillon", reference: "Chiron Tourbillon", lugToLugMm: 54, caseMm: 44 })
  },
  {
    urlIncludes: "intro-richard-mille-rm-30-01",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 30-01 Automatic With Declutchable Rotor", reference: "RM 30-01 Automatic with Declutchable Rotor", lugToLugMm: 49.9, caseMm: 42, thicknessMm: 17.59 })
  },
  {
    urlIncludes: "introducing-richard-mille-rm30-01-lemans-classic",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 30-01 Le Mans Classic", reference: "RM 30-01 Le Mans Classic", lugToLugMm: 50, caseMm: 42, thicknessMm: 17.59 })
  },
  {
    urlIncludes: "intro-richard-mille-rm-65-01-automatic-split-seconds-chronograph-in-sunny-yellow-and-sky-blue",
    records: semanticRecords(
      { brand: "Richard Mille", model: "RM 65-01 Yellow Quartz TPT", reference: "RM 65-01 Yellow Quartz TPT", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.1 },
      { brand: "Richard Mille", model: "RM 65-01 Blue Quartz TPT", reference: "RM 65-01 Blue Quartz TPT", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.1 }
    )
  },
  {
    urlIncludes: "introducing-lebron-james-richard-mille",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 65-01 LeBron James", reference: "RM 65-01 LeBron James", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.1 })
  },
  {
    urlIncludes: "richard-mille-rm-53-01-tourbillon-pablo-mac-donough-introducing",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 53-01 Tourbillon Pablo Mac Donough", reference: "RM 53-01", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.15 })
  },
  {
    urlIncludes: "the-richard-mille-rm-11-03-mclaren-automatic-flyback-chronograph",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 11-03 McLaren Automatic Flyback Chronograph", reference: "RM 11-03 McLaren", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.23 })
  },
  {
    urlIncludes: "the-richard-mille-rm-16-01-fraise-and-the-rm-07-03-marshmallow",
    records: semanticRecords(
      { brand: "Richard Mille", model: "RM 07-03 Marshmallow", reference: "RM 07-03 Marshmallow", lugToLugMm: 45.32, caseMm: 32.3, thicknessMm: 11.93 },
      { brand: "Richard Mille", model: "RM 16-01 Fraise", reference: "RM 16-01 Fraise", lugToLugMm: 50.2, caseMm: 38, thicknessMm: 9.88 }
    )
  },
  {
    urlIncludes: "a-look-at-longines-rectangular-watches-and-the-new-mini-dolce-vita",
    records: semanticRecords({ brand: "Longines", model: "Mini DolceVita 2023 Collection", reference: "Mini DolceVita 2023 Collection", lugToLugMm: 29, caseMm: 21.5, thicknessMm: 6.75 })
  },
  {
    urlIncludes: "a-sword-hand-seamaster-a-classic-5-digit-no-date-rolex-sub-and-a-two-tone-cartier-panthere",
    records: semanticRecords({ brand: "Audemars Piguet", model: "Millenary", reference: "15320OR", lugToLugMm: 40, caseMm: 45 })
  },
  {
    urlIncludes: "a-week-on-the-wrist-the-sevenfriday-p1",
    records: semanticRecords({ brand: "SevenFriday", model: "P1", reference: "P1", lugToLugMm: 47.6, caseMm: 47, thicknessMm: 13 })
  },
  {
    urlIncludes: "an-original-vacheron-constantin-american-1921-from-1919",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "American 1921 J.E. Caldwell 1919 Auction Example", reference: "American 1921 J.E. Caldwell 1919 Example", lugToLugMm: 42, caseMm: 32 })
  },
  {
    urlIncludes: "apple-watch-series-5-review",
    records: semanticRecords(
      { brand: "Apple", model: "Watch Series 5 44mm", reference: "Watch Series 5 44mm", lugToLugMm: 44, caseMm: 38, thicknessMm: 10.7 },
      { brand: "Apple", model: "Watch Series 5 40mm", reference: "Watch Series 5 40mm", lugToLugMm: 40, caseMm: 34, thicknessMm: 10.7 }
    )
  },
  ...[
    "armin-strom-masterpiece-1-dual-time-resonance-gmt-hands-on",
    "watches-we-love-but-wouldnt-wear"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Armin Strom", model: "Masterpiece 1 Dual Time Resonance GMT", reference: "Masterpiece 1 Dual Time Resonance GMT", lugToLugMm: 59, caseMm: 43.4, thicknessMm: 15.9 })
  })),
  {
    urlIncludes: "auctions-monaco-legend-fall-2024",
    records: semanticRecords({ brand: "Jules Jürgensen", model: "Five-Minute Repeating Wristwatch Auction Example", reference: "Monaco Legend Fall 2024 Example", lugToLugMm: 41, caseMm: 35 })
  },
  {
    urlIncludes: "audemars-piguet-ladies-millenary-three-glitzy-new-executions-introducing",
    records: semanticRecords({ brand: "Audemars Piguet", model: "Ladies' Millenary 2018 Collection", reference: "Ladies Millenary 2018 Collection", lugToLugMm: 35.4, caseMm: 39.5 })
  },
  {
    urlIncludes: "autodromo-prototipo-review",
    records: semanticRecords({ brand: "Autodromo", model: "Prototipo Chronograph", reference: "Prototipo Chronograph", lugToLugMm: 48, caseMm: 42, thicknessMm: 11.5 })
  },
  {
    urlIncludes: "bolt-from-the-blue-the-g-shock-blue-phoenix",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK Blue Phoenix", reference: "MRG-B2000BS-3A", lugToLugMm: 55, caseMm: 51, thicknessMm: 15.9 })
  },
  {
    urlIncludes: "bre-and-co-origami-watch-video",
    records: semanticRecords(
      { brand: "Bre & Co.", model: "Origami Watch Steel", reference: "Origami Watch Steel", lugToLugMm: 54, caseMm: 48, thicknessMm: 15 },
      { brand: "Bre & Co.", model: "Origami Watch Carbon", reference: "Origami Watch Carbon", lugToLugMm: 54, caseMm: 48, thicknessMm: 15 }
    )
  },
  {
    urlIncludes: "bring-a-loupe-april-14-2017",
    records: semanticRecords({ brand: "Piaget", model: "Beta 21", reference: "14101", lugToLugMm: 33, caseMm: 41 })
  },
  {
    urlIncludes: "bring-a-loupe-january-24-2025",
    records: semanticRecords({ brand: "Cartier", model: "London Tank L.C. Small Auction Example", reference: "London Tank LC Small Auction Example 2025", lugToLugMm: 26, caseMm: 19 })
  },
  {
    urlIncludes: "bring-a-loupe-may-8",
    records: semanticRecords({ brand: "Movado", model: "Polyplan 1917 Auction Example", reference: "Polyplan 1917 Auction Example", lugToLugMm: 44, caseMm: 22 })
  },
  {
    urlIncludes: "bring-a-loupe-may-9-2025",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "Vintage Rectangular Meister Auction Example", reference: "Meister Rectangular Auction Example 2025", lugToLugMm: 25, caseMm: 22.5, thicknessMm: 4 })
  },
  {
    urlIncludes: "bring-a-loupe-october-25-2024",
    records: semanticRecords({ brand: "Cartier", model: "London Tank L.C. Large Auction Example", reference: "London Tank LC Large Auction Example 2024", lugToLugMm: 30, caseMm: 23 })
  },
  {
    urlIncludes: "bring-a-loupe-september-21-2018",
    records: semanticRecords({ brand: "Cartier", model: "Tank Automatique Jumbo", reference: "17002", lugToLugMm: 35, caseMm: 28 })
  },
  {
    urlIncludes: "buying-selling-collecting-john-shaeffer-repeaters",
    records: semanticRecords({ brand: "Audemars Piguet", model: "John Shaeffer Repeater Archive Case", reference: "John Shaeffer Archive Case No. 6", lugToLugMm: 32, caseMm: 29.5 })
  },
  {
    urlIncludes: "cartier-100th-anniversary-tank-cintree-limited-edition-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Tank Cintrée 100th Anniversary Limited Edition", reference: "Tank Cintrée 100th Anniversary", lugToLugMm: 46.3, caseMm: 23, thicknessMm: 6.4 })
  },
  {
    urlIncludes: "cartier-presents-six-new-models-for-sihh-2016-with-live-pics",
    records: semanticRecords({ brand: "Cartier", model: "Crash Skeleton Pink Gold", reference: "Crash Skeleton Pink Gold 2016", lugToLugMm: 45.32, caseMm: 28.15 })
  },
  {
    urlIncludes: "cartier-prive-collection-cloche-de-cartier-introducing",
    records: semanticRecords({ brand: "Cartier", model: "Privé Cloche de Cartier 2021 Collection", reference: "Privé Cloche 2021 Collection", lugToLugMm: 38.17, caseMm: 28.75 })
  },
  {
    urlIncludes: "cartier-santos-review",
    records: semanticRecords(
      { brand: "Cartier", model: "Santos Medium 2018 Collection", reference: "Santos Medium 2018 Collection", lugToLugMm: 41.9, caseMm: 35.1, thicknessMm: 8.83 },
      { brand: "Cartier", model: "Santos Large 2018 Collection", reference: "Santos Large 2018 Collection", lugToLugMm: 47.5, caseMm: 39.8, thicknessMm: 9.08 }
    )
  },
  ...[
    "the-14-story-of-22-watches-that-say-success-video",
    "three-on-three-video-patek-cartier-vacheron"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Cartier", model: "Santos Medium 2018 Collection", reference: "Santos Medium 2018 Collection", lugToLugMm: 41.9, caseMm: 35.1, thicknessMm: 8.83 })
  })),
  {
    urlIncludes: "cartier-tank-americaine-stainless-steel-introducing",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Américaine Steel Small", reference: "Tank Américaine Steel Small 2017", lugToLugMm: 34.8, caseMm: 19 },
      { brand: "Cartier", model: "Tank Américaine Steel Medium", reference: "Tank Américaine Steel Medium 2017", lugToLugMm: 41.6, caseMm: 22.6 },
      { brand: "Cartier", model: "Tank Américaine Steel Large", reference: "Tank Américaine Steel Large 2017", lugToLugMm: 45.1, caseMm: 26.6 }
    )
  },
  {
    urlIncludes: "cartier-tank-americaine-steel-review",
    records: semanticRecords({ brand: "Cartier", model: "Tank Américaine Steel Medium", reference: "Tank Américaine Steel Medium 2017", lugToLugMm: 41.6, caseMm: 22.6 })
  },
  {
    urlIncludes: "casio-g-shock-gm-6900-metal-lineup-hands-on",
    records: semanticRecords(
      { brand: "Casio", model: "G-SHOCK GM-6900 Metal", reference: "GM6900-1", lugToLugMm: 53.9, caseMm: 49.7, thicknessMm: 18.6 },
      { brand: "Casio", model: "G-SHOCK GM-6900 Metal Black IP", reference: "GM6900B-4", lugToLugMm: 53.9, caseMm: 49.7, thicknessMm: 18.6 },
      { brand: "Casio", model: "G-SHOCK GM-6900 Metal Gold IP", reference: "GM6900G-9", lugToLugMm: 53.9, caseMm: 49.7, thicknessMm: 18.6 }
    )
  },
  {
    urlIncludes: "casio-g-shock-mrg-g1000b-1a4-akazonae",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK MRG-G1000 Akazonae", reference: "MRG-G1000B-1A4", lugToLugMm: 54.7, caseMm: 49.8, thicknessMm: 16.9 })
  },
  {
    urlIncludes: "chanel-premiere-camelia-skeleton-watch-introducing",
    records: semanticRecords({ brand: "Chanel", model: "Première Camélia Skeleton", reference: "Première Camélia Skeleton", lugToLugMm: 37, caseMm: 28.5 })
  },
  {
    urlIncludes: "digi-cool-watches-from-the-seventies-are-back-with-a-sleek-vengeance",
    records: semanticRecords({ brand: "Girard-Perregaux", model: "Casquette 2.0", reference: "Casquette 2.0", lugToLugMm: 42.4, caseMm: 33.6, thicknessMm: 14.64 })
  },
  {
    urlIncludes: "fiona-kruger-celebration-skull-black-hands-on",
    records: semanticRecords({ brand: "Fiona Krüger", model: "Celebration Skull Black", reference: "Celebration Skull Black", lugToLugMm: 57.4, caseMm: 41.3, thicknessMm: 10.9 })
  },
  {
    urlIncludes: "going-art-deco-with-the-jaeger-lecoultre-reverso",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Classic Large Small Seconds", reference: "Reverso Classic Large Small Seconds", lugToLugMm: 46, caseMm: 27.5 })
  },
  {
    urlIncludes: "grab-your-tv-dinners-mido-debuts-a-new-limited-edition-multifort-big-date",
    records: semanticRecords({ brand: "Mido", model: "Multifort TV Big Date S01E01", reference: "Multifort TV Big Date S01E01", lugToLugMm: 39.2, caseMm: 40 })
  },
  {
    urlIncludes: "gshock-clear-casioak-i-bought-for-summer",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK Clear CasiOak", reference: "GA2100SKE-7A", lugToLugMm: 48.55, caseMm: 45.4, thicknessMm: 11.8 })
  },
  {
    urlIncludes: "h-moser-swiss-alp-vantablack-watch-hands-on",
    records: semanticRecords({ brand: "H. Moser & Cie.", model: "Swiss Alp Watch Final Upgrade", reference: "Swiss Alp Watch Final Upgrade", lugToLugMm: 44, caseMm: 38.2, thicknessMm: 10.5 })
  },
  {
    urlIncludes: "moser-swiss-alp-watch-zzzz",
    records: semanticRecords({ brand: "H. Moser & Cie.", model: "Swiss Alp Watch Zzzz", reference: "Swiss Alp Watch Zzzz", lugToLugMm: 44, caseMm: 38.2, thicknessMm: 10.3 })
  },
  {
    urlIncludes: "hamilton-odc-x-03-introducing",
    records: semanticRecords({ brand: "Hamilton", model: "ODC X-03", reference: "ODC X-03", lugToLugMm: 52, caseMm: 49 })
  },
  {
    urlIncludes: "hamilton-ventura-2017-60th-anniversary-edition-introducing",
    records: semanticRecords(
      { brand: "Hamilton", model: "Ventura Classic Small 60th Anniversary", reference: "Ventura Classic Small 60th Anniversary", lugToLugMm: 36.5, caseMm: 24 },
      { brand: "Hamilton", model: "Ventura Classic Large 60th Anniversary", reference: "Ventura Classic Large 60th Anniversary", lugToLugMm: 50.3, caseMm: 32.3 }
    )
  },
  {
    urlIncludes: "hands-on-cartier-tank-lc-sapphire-skeleton",
    records: semanticRecords({ brand: "Cartier", model: "Tank Louis Cartier Sapphire Skeleton", reference: "Tank LC Sapphire Skeleton", lugToLugMm: 39.2, caseMm: 30, thicknessMm: 7.45 })
  },
  {
    urlIncludes: "hands-on-daniel-roth-extra-plat-skeleton-rose",
    records: semanticRecords({ brand: "Daniel Roth", model: "Extra-Plat Skeleton", reference: "DBBD02A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 6.9 })
  },
  {
    urlIncludes: "hands-on-daniel-roth-tourbillon-rose-gold",
    records: semanticRecords({ brand: "Daniel Roth", model: "Tourbillon Rose Gold", reference: "DAAD01A1", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 9.2 })
  },
  {
    urlIncludes: "hands-on-jlc-reverso-tribute-to-geographic",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Geographic Pink Gold", reference: "Q714256J", lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.4 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Geographic Steel", reference: "Q714845J", lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.4 }
    )
  },
  ...[
    "hands-on-with-the-urwerk-emc-electro-mechanical-control",
    "urwerk-timehunter-x-ray-emc-introducing"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Urwerk", model: "EMC TimeHunter", reference: "EMC TimeHunter", lugToLugMm: 51, caseMm: 43, thicknessMm: 15.8 })
  })),
  {
    urlIncludes: "hermes-carre-h-marc-berthier-introducing",
    records: semanticRecords({ brand: "Hermès", model: "Carré H", reference: "Carré H 2018", lugToLugMm: 38, caseMm: 38 })
  },
  {
    urlIncludes: "hermes-h08-2021",
    records: semanticRecords({ brand: "Hermès", model: "H08 2021 Collection", reference: "H08 2021 Collection", lugToLugMm: 39, caseMm: 39 })
  },
  {
    urlIncludes: "how-hamillton-made-a-watch-for-dune-part-2",
    records: semanticRecords({ brand: "Hamilton", model: "Ventura XXL Bright Dune Limited Edition", reference: "Ventura XXL Bright Dune", lugToLugMm: 52, caseMm: 46.6, thicknessMm: 12, approximate: true })
  },
  {
    urlIncludes: "hyt-h3-linear-fluid-time-display-hands-on",
    records: semanticRecords({ brand: "HYT", model: "H3", reference: "H3", lugToLugMm: 62, caseMm: 41 })
  },
  {
    urlIncludes: "i-bought-a-bag-of-watches-for-dollar50",
    records: semanticRecords({ brand: "Jupiter", model: "Vintage Ladies' Bracelet Watch", reference: "Bag Of Watches Jupiter Example", lugToLugMm: 27, caseMm: 18.5 })
  },
  {
    urlIncludes: "introducing-desder-d001",
    records: semanticRecords({ brand: "Desder", model: "D001", reference: "D001", lugToLugMm: 46, caseMm: 24.8 })
  },
  {
    urlIncludes: "introducing-glashutte-original-70s-chronograph",
    records: semanticRecords({ brand: "Glashütte Original", model: "Seventies X Chronograph", reference: "Seventies X Chronograph", lugToLugMm: 40, caseMm: 40, thicknessMm: 14.1 })
  },
  {
    urlIncludes: "introducing-the-chapter-one-round-transparence",
    records: semanticRecords({ brand: "Maîtres du Temps", model: "Chapter One Round Transparence", reference: "Chapter One Round Transparence", lugToLugMm: 59, caseMm: 62 })
  },
  {
    urlIncludes: "introducing-the-jaeger-lecoultre-grande-reverso-night-day",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Grande Reverso Night & Day", reference: "Grande Reverso Night & Day", lugToLugMm: 46.8, caseMm: 27.4, thicknessMm: 9.14 })
  },
  {
    urlIncludes: "introducing-the-mbf-hm6-space-pirate-live-pics",
    records: semanticRecords({ brand: "MB&F", model: "HM6 Space Pirate", reference: "HM6 Space Pirate", lugToLugMm: 52.3, caseMm: 49.5, thicknessMm: 20.4 })
  },
  {
    urlIncludes: "introducing-the-romain-jerome-moon-orbiter",
    records: semanticRecords({ brand: "Romain Jerome", model: "Moon Orbiter", reference: "Moon Orbiter", lugToLugMm: 49, caseMm: 45, thicknessMm: 20 })
  },
  ...[
    "introducing-the-urwerk-ur-105m-iron-knight-and-dark-knight",
    "hands-on-with-the-urwerk-ur-105m-dark-knight"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords(
      { brand: "Urwerk", model: "UR-105M Iron Knight", reference: "UR-105M Iron Knight", lugToLugMm: 53, caseMm: 39.5, thicknessMm: 16.65 },
      { brand: "Urwerk", model: "UR-105M Dark Knight", reference: "UR-105M Dark Knight", lugToLugMm: 53, caseMm: 39.5, thicknessMm: 16.65 }
    )
  })),
  {
    urlIncludes: "jacob-and-co-twin-turbo-furious-hands-on",
    records: semanticRecords({ brand: "Jacob & Co.", model: "Twin Turbo Furious", reference: "Twin Turbo Furious", lugToLugMm: 57, caseMm: 52 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-classic-large-duo-small-second-atelier-reverso",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Classic Large Duo Small Second", reference: "Reverso Classic Large Duo Small Second", lugToLugMm: 47, caseMm: 28.3 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-quadriptyque-introducing",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Hybris Mechanica Calibre 185 Quadriptyque", reference: "Q7103420", lugToLugMm: 51.2, caseMm: 31, thicknessMm: 15.15 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-tribute-calendar-week-on-the-wrist",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Calendar", reference: "Reverso Tribute Calendar", lugToLugMm: 49.7, caseMm: 29.9 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-tribute-duoface-introducing",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Duoface", reference: "Reverso Tribute Duoface 2016", lugToLugMm: 49.4, caseMm: 29.9 })
  },
  {
    urlIncludes: "jaeger-lecoultre-reverso-tribute-enamel-hokusai-waterfalls-series",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Enamel Hokusai Waterfalls Series", reference: "Reverso Hokusai Waterfalls Series", lugToLugMm: 45.6, caseMm: 27.4, thicknessMm: 9.73 })
  },
  {
    urlIncludes: "mbandf-hm10-bulldog-hands-on",
    records: semanticRecords({ brand: "MB&F", model: "HM10 Bulldog", reference: "HM10 Bulldog", lugToLugMm: 54, caseMm: 45, thicknessMm: 24 })
  },
  {
    urlIncludes: "mbandf-horological-machine-8-can-am-hands-on",
    records: semanticRecords({ brand: "MB&F", model: "HM8 Can-Am", reference: "HM8 Can-Am", lugToLugMm: 51.5, caseMm: 49, thicknessMm: 19 })
  },
  {
    urlIncludes: "nine-vintage-vacheron-constantin-watches-new-york-boutique",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "Square-Cased 1951 Les Collectionneurs", reference: "Square-Cased 1951 Les Collectionneurs", lugToLugMm: 37, caseMm: 27 })
  },
  {
    urlIncludes: "omega-relaunches-the-ploprof-with-1970s-era-proportions",
    records: semanticRecords({ brand: "Omega", model: "Seamaster Ploprof 2025", reference: "227.32.55.21.03.001", lugToLugMm: 45, caseMm: 55, thicknessMm: 15.5 })
  },
  {
    urlIncludes: "just-because-a-hands-on-look-at-the-omega-seamaster-professional-ploprof-1200",
    records: semanticRecords({ brand: "Omega", model: "Seamaster Ploprof 1200M", reference: "227.90.55.21.04.001", lugToLugMm: 48, caseMm: 55 })
  },
  {
    urlIncludes: "on-the-block-president-john-f-kennedys-personal-bulova-watch",
    records: semanticRecords({ brand: "Bulova", model: "John F. Kennedy Personal Watch", reference: "JFK Personal Bulova Auction Example", lugToLugMm: 36, caseMm: 22 })
  },
  {
    urlIncludes: "our-40-favorite-watches-on-the-market-right-now",
    records: semanticRecords(
      { brand: "Cartier", model: "Crash London Boutique", reference: "WGCH0006", lugToLugMm: 38.5, caseMm: 22.5 },
      { brand: "Cartier", model: "Panthère de Cartier", reference: "Panthère de Cartier Editors Pick", lugToLugMm: 30, caseMm: 23 }
    )
  },
  {
    urlIncludes: "our-7-favorite-outdoor-watches-and-the-places-wed-like-to-take-them",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK Rangeman", reference: "G-SHOCK Rangeman Editors Pick", lugToLugMm: 61.2, caseMm: 54.4, thicknessMm: 16.1 })
  },
  {
    urlIncludes: "pharrell-williams-wears-an-rm-up-01-again",
    records: semanticRecords({ brand: "Richard Mille", model: "RM UP-01 Ferrari", reference: "RM UP-01 Ferrari", lugToLugMm: 51, caseMm: 39, thicknessMm: 1.75 })
  },
  {
    urlIncludes: "pre-sihh-2014-hands-on-with-the-jaeger-lecoultre-grand-reverso-ultra-thin-tribute-to-1931-chocolate",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Grande Reverso Ultra Thin Tribute To 1931 Chocolate", reference: "Grande Reverso 1931 Chocolate", lugToLugMm: 46.8, caseMm: 27.4, thicknessMm: 7.3 })
  },
  {
    urlIncludes: "pre-sihh-2016-jaeger-lecoultre-introduces-new-reverso-classic-tribute-models",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Classic Small 2016", reference: "Reverso Classic Small 2016", lugToLugMm: 34, caseMm: 21, thicknessMm: 7.4 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Classic Medium 2016", reference: "Reverso Classic Medium 2016", lugToLugMm: 40, caseMm: 24.4, thicknessMm: 9 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Classic Large 2016", reference: "Reverso Classic Large 2016", lugToLugMm: 45.6, caseMm: 27.4, thicknessMm: 9.7 }
    )
  },
  {
    urlIncludes: "rado-ceramica-konstantin-grcic-introducing",
    records: semanticRecords({ brand: "Rado", model: "Ceramica Konstantin Grcic", reference: "Ceramica Konstantin Grcic", lugToLugMm: 41, caseMm: 30, thicknessMm: 7.6 })
  },
  {
    urlIncludes: "richard-mille-rm-17-01-tourbillon-carbon-tpt-hands-on",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 17-01 Tourbillon Carbon TPT", reference: "RM 17-01", lugToLugMm: 48.15, caseMm: 40.1, thicknessMm: 13.8 })
  },
  {
    urlIncludes: "richard-mille-rm-27-03-for-rafael-nadal-introducing",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 27-03 Rafael Nadal", reference: "RM 27-03", lugToLugMm: 47.77, caseMm: 40.3, thicknessMm: 12.75 })
  },
  {
    urlIncludes: "richard-mille-rm-53-01-tourbillon-pablo-mac-donough-hands-on",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 53-01 Tourbillon Pablo Mac Donough", reference: "RM 53-01", lugToLugMm: 49.94, caseMm: 44.5, thicknessMm: 16.15 })
  },
  {
    urlIncludes: "richard-mille-rm07-01-gem-set-black-ceramic",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 07-01 Gem-Set Black Ceramic", reference: "RM 07-01 Gem-Set Black Ceramic", lugToLugMm: 45.66, caseMm: 31.04, thicknessMm: 11.85 })
  },
  {
    urlIncludes: "sneak-peek-a-very-early-look-at-the-cartier-tank-mc",
    records: semanticRecords({ brand: "Cartier", model: "Tank MC", reference: "Tank MC", lugToLugMm: 44, caseMm: 34 })
  },
  {
    urlIncludes: "the-cartier-prive-tank-chinoise-brings-back-a-classic",
    records: semanticRecords({ brand: "Cartier", model: "Privé Tank Chinoise 2022 Collection", reference: "Privé Tank Chinoise 2022 Collection", lugToLugMm: 39.5, caseMm: 29.2, thicknessMm: 7.7 })
  },
  {
    urlIncludes: "the-cartier-tank-cintree",
    records: semanticRecords({ brand: "Cartier", model: "Tank Cintrée Historical Example", reference: "Tank Cintrée Historical Example", lugToLugMm: 44.7, caseMm: 23 })
  },
  {
    urlIncludes: "the-casio-master-of-g-g-shock-frogman-gwf-d1000b",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK Frogman", reference: "GWF-D1000B", lugToLugMm: 59.2, caseMm: 53.3, thicknessMm: 18 })
  },
  {
    urlIncludes: "the-delightfully-anachronistic-bulova-computron",
    records: semanticRecords({ brand: "Bulova", model: "Computron", reference: "Computron 2019", lugToLugMm: 41.5, caseMm: 31, thicknessMm: 13.8 })
  },
  {
    urlIncludes: "the-fp-journe-vagabondage-iii",
    records: semanticRecords({ brand: "F.P. Journe", model: "Vagabondage III", reference: "Vagabondage III", lugToLugMm: 45.2, caseMm: 37.6, thicknessMm: 7.8 })
  },
  {
    urlIncludes: "the-hermes-dressage-lheure-masquee",
    records: semanticRecords({ brand: "Hermès", model: "Dressage L'Heure Masquée", reference: "Dressage H1837", lugToLugMm: 40.5, caseMm: 38.4 })
  },
  {
    urlIncludes: "the-histoire-de-tourbillon-6-by-harry-winston",
    records: semanticRecords({ brand: "Harry Winston", model: "Histoire de Tourbillon 6", reference: "Histoire de Tourbillon 6", lugToLugMm: 55, caseMm: 49 })
  },
  {
    urlIncludes: "the-hodinkee-editors-top-picks-from-sihh-2016",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Tribute Reverso Duo", reference: "Tribute Reverso Duo", lugToLugMm: 42.8, caseMm: 25.5 })
  },
  {
    urlIncludes: "the-hyt-supernova-blue-moon-runner",
    records: semanticRecords({ brand: "HYT", model: "Supernova Blue Moon Runner", reference: "Supernova Blue Moon Runner", lugToLugMm: 52.3, caseMm: 48, thicknessMm: 21.8 })
  },
  {
    urlIncludes: "the-moritz-grossmann-corner-stone-with-the-new-caliber-1023",
    records: semanticRecords({ brand: "Moritz Grossmann", model: "Corner Stone", reference: "Corner Stone", lugToLugMm: 46.6, caseMm: 29.5, thicknessMm: 9.76 })
  },
  {
    urlIncludes: "the-new-cartier-coussin-collection-includes-watches-that-are-actual-cushions",
    records: semanticRecords({ brand: "Cartier", model: "Coussin de Cartier Flexible Case", reference: "Coussin Flexible Case 2022", lugToLugMm: 39.3, caseMm: 31.9, thicknessMm: 13.6 })
  },
  {
    urlIncludes: "the-new-cartier-tank-francaise-is-no-ladies-watch",
    records: semanticRecords(
      { brand: "Cartier", model: "Tank Française Small 2023", reference: "Tank Française Small 2023", lugToLugMm: 25.7, caseMm: 21.2 },
      { brand: "Cartier", model: "Tank Française Medium 2023", reference: "Tank Française Medium 2023", lugToLugMm: 32, caseMm: 27 },
      { brand: "Cartier", model: "Tank Française Large 2023", reference: "Tank Française Large 2023", lugToLugMm: 36.7, caseMm: 30.5 }
    )
  },
  {
    urlIncludes: "the-omega-speedmaster-mark-ii-rio-2016",
    records: semanticRecords({ brand: "Omega", model: "Speedmaster Mark II Rio 2016", reference: "Speedmaster Mark II Rio 2016", lugToLugMm: 46.2, caseMm: 42.4 })
  },
  {
    urlIncludes: "the-patek-philippe-ellipse-is-once-again-on-a-bracelet",
    records: semanticRecords({ brand: "Patek Philippe", model: "Original Golden Ellipse 1968", reference: "Original Golden Ellipse 1968", lugToLugMm: 32, caseMm: 27 })
  },
  {
    urlIncludes: "the-reverso-that-revived-the-jaeger-lecoultre-reverso",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Corvo Reverso", reference: "Corvo Reverso", lugToLugMm: 38, caseMm: 23 })
  },
  {
    urlIncludes: "the-richard-mille-59-01-tourbillon-yohan-blake",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 59-01 Tourbillon Yohan Blake", reference: "RM 59-01", lugToLugMm: 50, caseMm: 43, thicknessMm: 16 })
  },
  {
    urlIncludes: "the-richard-mille-rm-67-01-the-flattest-richard-mille-so-far",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 67-01 Automatic Extra Flat", reference: "RM 67-01", lugToLugMm: 47.52, caseMm: 38.7, thicknessMm: 7.75 })
  },
  {
    urlIncludes: "watch-spotting-jayson-tatum-celtics-championship-parade",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 67-02 Jayson Tatum", reference: "RM 67-02 Jayson Tatum", lugToLugMm: 47.52, caseMm: 38.7, thicknessMm: 7.8 })
  },
  {
    urlIncludes: "weekend-warrior-the-casio-wsd-f10-smart-outdoor-watch",
    records: semanticRecords({ brand: "Casio", model: "WSD-F10 Smart Outdoor Watch", reference: "WSD-F10", lugToLugMm: 61.7, caseMm: 56.4, thicknessMm: 15.7 })
  },
  {
    urlIncludes: "with-the-cartier-hypnose",
    records: semanticRecords(
      { brand: "Cartier", model: "Hypnose Small", reference: "Hypnose Small", lugToLugMm: 30, caseMm: 26.2 },
      { brand: "Cartier", model: "Hypnose Medium", reference: "Hypnose Medium", lugToLugMm: 38, caseMm: 33 }
    )
  },
  {
    urlIncludes: "with-the-cartier-tank-anglaise",
    records: semanticRecords({ brand: "Cartier", model: "Tank Anglaise Medium", reference: "Tank Anglaise Medium Reviewed Example", lugToLugMm: 39.2, caseMm: 29.8 })
  },
  {
    urlIncludes: "with-the-chanel-boy-friend-watch",
    records: semanticRecords(
      { brand: "Chanel", model: "Boy.Friend Medium", reference: "Boy.Friend Medium", lugToLugMm: 34.6, caseMm: 26.7 },
      { brand: "Chanel", model: "Boy.Friend Large", reference: "Boy.Friend Large", lugToLugMm: 37, caseMm: 28.6 }
    )
  },
  {
    urlIncludes: "your-guide-to-black-friday-in-the-hodinkee-shop",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Small Shop Example", reference: "Reverso Small Shop Example", lugToLugMm: 34, caseMm: 21 })
  },
  {
    urlIncludes: "panthere-de-cartier-now-comes-in-extra-large",
    records: semanticRecords(
      { brand: "Cartier", model: "Panthère de Cartier Large 1983", reference: "Panthère Large 1983", lugToLugMm: 36, caseMm: 27 },
      { brand: "Cartier", model: "Panthère de Cartier Large 1985", reference: "Panthère Large 1985", lugToLugMm: 40, caseMm: 29 },
      { brand: "Cartier", model: "Panthère de Cartier Large 2024", reference: "Panthère Large 2024", lugToLugMm: 42, caseMm: 31 }
    )
  },
  {
    urlIncludes: "parmigiani-fleurier-pantographe-telescoping-hands-on",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Pantographe", reference: "Pantographe", lugToLugMm: 45, caseMm: 37.6, thicknessMm: 12 })
  },
  {
    urlIncludes: "the-richard-mille-rm-up-01-a-very-deep-dive",
    records: semanticRecords({ brand: "Richard Mille", model: "RM UP-01 Ferrari", reference: "RM UP-01 Ferrari", lugToLugMm: 51, caseMm: 39, thicknessMm: 1.75 })
  },
  {
    urlIncludes: "the-richard-mille-67-02-sprint-and-high-jump",
    records: semanticRecords(
      { brand: "Richard Mille", model: "RM 67-02 Sprint", reference: "RM 67-02 Sprint", lugToLugMm: 47.52, caseMm: 38.7, thicknessMm: 7.8 },
      { brand: "Richard Mille", model: "RM 67-02 High Jump", reference: "RM 67-02 High Jump", lugToLugMm: 47.52, caseMm: 38.7, thicknessMm: 7.8 }
    )
  },
  {
    urlIncludes: "three-richard-mille-watches-celebrating-the-motorsports-career-of-jean-todt",
    records: semanticRecords({ brand: "Richard Mille", model: "RM 050 Jean Todt 50th Anniversary", reference: "RM 050 Jean Todt", lugToLugMm: 50, caseMm: 42.7 })
  },
  {
    urlIncludes: "hands-on-jlc-reverso-cocktails",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Monoface Or Deco Cocktail", reference: "Reverso Or Deco Cocktail", lugToLugMm: 45.6, caseMm: 27.4, thicknessMm: 7.56 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Monoface Or Deco Cocktail Small", reference: "Reverso Or Deco Cocktail Small", lugToLugMm: 40, caseMm: 24.4, thicknessMm: 7.56 }
    )
  },
  {
    urlIncludes: "john-goodman-wears-a-casio-g-shock-in-the-big-lebowski",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK DW-5900 Three Eye", reference: "DW-5900", lugToLugMm: 51.4, caseMm: 46.8, thicknessMm: 15.5 })
  },
  {
    urlIncludes: "urwerk-brings-a-new-case-material-to-the-ur-230-polaris",
    records: semanticRecords({ brand: "Urwerk", model: "UR-230 Polaris", reference: "UR-230 Polaris", lugToLugMm: 53.55, caseMm: 44.8 })
  },
  {
    urlIncludes: "vacheron-constantin-launches-the-ultra-complicated-ref-57260",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "Malte High Jewellery Large", reference: "Malte High Jewellery Large", lugToLugMm: 48.24, caseMm: 38 })
  },
  {
    urlIncludes: "vacheron-constantin-ten-new-harmony-models-introducing",
    records: semanticRecords(
      { brand: "Vacheron Constantin", model: "Harmony Complete Calendar", reference: "Harmony Complete Calendar 2016", lugToLugMm: 49.3, caseMm: 40, thicknessMm: 11 },
      { brand: "Vacheron Constantin", model: "Harmony Tourbillon Chronograph Pink Gold", reference: "Harmony Tourbillon Chronograph Pink Gold 2016", lugToLugMm: 52, caseMm: 42, thicknessMm: 12.81 },
      { brand: "Vacheron Constantin", model: "Harmony Chronograph Small", reference: "Harmony Chronograph Small 2016", lugToLugMm: 46.6, caseMm: 37, thicknessMm: 11.74 },
      { brand: "Vacheron Constantin", model: "Harmony Dual Time Large", reference: "Harmony Dual Time Large 2016", lugToLugMm: 49.3, caseMm: 40, thicknessMm: 11.43 }
    )
  },
  {
    urlIncludes: "bring-a-loupe-february-10-2017",
    records: semanticRecords({ brand: "Cartier", model: "Tank Arrondie 1970s Auction Example", reference: "Tank Arrondie Auction Example 2017", lugToLugMm: 29, caseMm: 23 })
  },
  {
    urlIncludes: "cellini-rolex-prince-the-rolex-nobody-knows-and-should",
    records: semanticRecords({ brand: "Rolex", model: "Cellini Prince", reference: "Cellini Prince Collection", lugToLugMm: 45, caseMm: 29 })
  },
  {
    urlIncludes: "chanel-calibre-3-hands-on",
    records: semanticRecords({ brand: "Chanel", model: "Boy.Friend Calibre 3", reference: "Boy.Friend Calibre 3", lugToLugMm: 37, caseMm: 28.6 })
  },
  {
    urlIncludes: "editors-picks-the-hodinkee-valentines-day-2016-watch-gift-guide",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Grande Reverso 1931 Seconde Centrale", reference: "Grande Reverso 1931 Seconde Centrale", lugToLugMm: 46.8, caseMm: 27.8 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Cordonnet", reference: "Reverso Cordonnet", lugToLugMm: 33.8, caseMm: 16.3 }
    )
  },
  {
    urlIncludes: "elton-john-shows-us-that-vintage-chopard-is-worth-a-revisit",
    records: semanticRecords({ brand: "Chopard", model: "Kutchinsky Dual Time", reference: "5093", lugToLugMm: 24, caseMm: 46 })
  },
  {
    urlIncludes: "english-premier-league-managers-watches",
    records: semanticRecords({ brand: "Cvstos", model: "Challenge Chrono II", reference: "Challenge Chrono II", lugToLugMm: 53.7, caseMm: 41 })
  },
  ...[
    ["from-the-worlds-factory-to-a-watchmaking-culture", 17.4],
    ["gphg-2025-finalists", 12.9]
  ].map(([urlIncludes, thicknessMm]) => ({
    urlIncludes,
    records: semanticRecords({ brand: "Fam al Hut", model: "Möbius Mark I Bi-Axis Tourbillon", reference: "Möbius Mark I", lugToLugMm: 42.2, caseMm: 24.3, thicknessMm })
  })),
  {
    urlIncludes: "hands-vacheron-constantin-les-cabinotiers-voyages",
    records: semanticRecords({ brand: "Vacheron Constantin", model: "Les Cabinotiers Malte Tourbillon Tribute To Haussmannian Style", reference: "30135/000R-089C", lugToLugMm: 41.5, caseMm: 38, thicknessMm: 12.7 })
  },
  {
    urlIncludes: "heres-why-i-traded-my-cartier-santos-dumont-for-a-tank",
    records: semanticRecords({ brand: "Cartier", model: "Santos-Dumont CPCP Platinum", reference: "Santos-Dumont CPCP Platinum", lugToLugMm: 36, caseMm: 27 })
  },
  {
    urlIncludes: "from-a-lecoultre-deep-sea-alarm-on-ebay-to-a-crazy-vintage-b",
    records: semanticRecords({ brand: "Cartier", model: "Tank Automatique Jumbo", reference: "17002", lugToLugMm: 34.5, caseMm: 28 })
  },
  ...[
    "reference-points-cartier-tank-louis",
    "the-6-story-of-25-reference-points-the-cartier-tank-louis"
  ].map((urlIncludes) => ({
    urlIncludes,
    records: semanticRecords(
      { brand: "Cartier", model: "London Tank L.C. Small", reference: "London Tank LC Small", lugToLugMm: 26, caseMm: 18 },
      { brand: "Cartier", model: "London Tank L.C. Medium", reference: "London Tank LC Medium", lugToLugMm: 28, caseMm: 21 },
      { brand: "Cartier", model: "London Tank L.C. Large", reference: "London Tank LC Large", lugToLugMm: 31, caseMm: 23 }
    )
  })),
  {
    urlIncludes: "the-13-story-of-25-buying-selling-and-collecting-the-full-story-of-audemars-piguets-john-shaeffer",
    records: semanticRecords({ brand: "Audemars Piguet", model: "John Shaeffer Repeater Archive Case", reference: "John Shaeffer Archive Case No. 6", lugToLugMm: 32, caseMm: 29.5 })
  },
  {
    urlIncludes: "the-amida-digitrend-brings-back-the-70s-with-its-digital-drivers-watch",
    records: semanticRecords({ brand: "Amida", model: "Digitrend Open Sapphire", reference: "Digitrend Open Sapphire", lugToLugMm: 39.6, caseMm: 39, thicknessMm: 16 })
  },
  {
    urlIncludes: "the-cartier-prive-normale",
    records: semanticRecords(
      { brand: "Cartier", model: "Privé Tank Normale", reference: "Tank Normale", lugToLugMm: 32.6, caseMm: 25.7, thicknessMm: 6.85 },
      { brand: "Cartier", model: "Privé Tank Normale Skeleton", reference: "Privé Tank Normale Skeleton", lugToLugMm: 35.2, caseMm: 27.8, thicknessMm: 8.15 }
    )
  },
  {
    urlIncludes: "the-daniel-roth-tourbillon-in-platinum",
    records: semanticRecords({ brand: "Daniel Roth", model: "Tourbillon Platinum", reference: "Daniel Roth Tourbillon Platinum 2025", lugToLugMm: 38.6, caseMm: 35.5, thicknessMm: 9.2 })
  },
  {
    urlIncludes: "the-parmigiani-fleurier-bugatti-type-390-for-the-bugatti-chiron-sport",
    records: semanticRecords({ brand: "Parmigiani Fleurier", model: "Bugatti Type 390", reference: "Bugatti Type 390", lugToLugMm: 57.7, caseMm: 42.2, thicknessMm: 18.4 })
  },
  {
    urlIncludes: "the-reverso-tribute-minute-repeater-two-faces-one-voice",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Minute Repeater", reference: "Q7122480", lugToLugMm: 51.1, caseMm: 31, thicknessMm: 12.6 })
  },
  {
    urlIncludes: "these-five-watches-will-help-you-keep-your-new-years-resolutions-past-january",
    records: semanticRecords({ brand: "Casio", model: "G-SHOCK Rangeman GPR-H1000", reference: "GPR-H1000", lugToLugMm: 60.6, caseMm: 53.2, thicknessMm: 20.3 })
  },
  {
    urlIncludes: "tiffany-east-west-automatic-hands-on",
    records: semanticRecords({ brand: "Tiffany & Co.", model: "East West Automatic", reference: "East West Automatic", lugToLugMm: 27.5, caseMm: 46.5 })
  },
  {
    urlIncludes: "two-new-breguet-reine-de-naples-watches-2019-hands-on",
    records: semanticRecords({ brand: "Breguet", model: "Reine de Naples 2019 Collection", reference: "Reine de Naples 2019 Collection", lugToLugMm: 36.5, caseMm: 28.45 })
  },
  {
    urlIncludes: "watch-shopping-chicago-a-visit-to-the-new-marshall-pierce",
    records: semanticRecords({ brand: "Cartier", model: "Tank Louis Cartier Large Four-Dial Collection", reference: "Tank Louis Cartier Large Four-Dial Collection", lugToLugMm: 33.7, caseMm: 25.5, thicknessMm: 6.6 })
  },
  {
    urlIncludes: "why-jaeger-lecoultres-latest-traveling-collection-is-worth-your-time",
    records: semanticRecords({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Gyrotourbillon", reference: "Reverso Tribute Gyrotourbillon", lugToLugMm: 51.1, caseMm: 31, thicknessMm: 12.4 })
  },
  {
    urlIncludes: "citizen-celebrates-35-years-of-the-promaster-with-a-limited-edition-trio",
    records: semanticRecords({ brand: "Citizen", model: "Promaster Mechanical Diver 200m Fujitsubo 35th Anniversary", reference: "Fujitsubo 35th Anniversary", lugToLugMm: 48.5, caseMm: 41, thicknessMm: 12.3 })
  },
  {
    urlIncludes: "our-eight-favorite-watches-from-geneva-watch-days-2022",
    records: semanticRecords({ brand: "Tudor", model: "Pelagos 39", reference: "M25407N-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.8 })
  },
  {
    urlIncludes: "our-favorite-watches-of-2025",
    records: semanticRecords({ brand: "CWC x Hodinkee", model: "Royal Navy Diver", reference: "Royal Navy Diver Hodinkee", lugToLugMm: 47.6, caseMm: 41.5, thicknessMm: 12.2 })
  },
  {
    urlIncludes: "the-vpc-type-37hw",
    records: semanticRecords({ brand: "VPC", model: "Type 37HW", reference: "Type 37HW", lugToLugMm: 45, caseMm: 37.5, thicknessMm: 9.8 })
  },
  {
    urlIncludes: "want-to-see-all-of-bremonts-new-releases-weve-got-you-covered",
    records: semanticRecords(
      { brand: "Bremont", model: "Airco Mach 1 Jet", reference: "Airco Mach 1 Jet", lugToLugMm: 49, caseMm: 40, thicknessMm: 12 },
      { brand: "Bremont", model: "Argonaut Bronze", reference: "Argonaut Bronze", lugToLugMm: 50, caseMm: 42, thicknessMm: 12.7 },
      { brand: "Bremont", model: "Limited Edition Dambuster", reference: "Limited Edition Dambuster", lugToLugMm: 51.5, caseMm: 42, thicknessMm: 14.9 },
      { brand: "Bremont", model: "S502 Jet", reference: "S502 Jet", lugToLugMm: 51, caseMm: 43, thicknessMm: 16.5 },
      { brand: "Bremont", model: "Supermarine Chrono Jet", reference: "Supermarine Chrono Jet", lugToLugMm: 49, caseMm: 43, thicknessMm: 15.8 },
      { brand: "Bremont", model: "Supermarine Descent II", reference: "Supermarine Descent II", lugToLugMm: 51, caseMm: 43, thicknessMm: 16.5 },
      { brand: "Bremont", model: "WR-22", reference: "WR-22", lugToLugMm: 49, caseMm: 43, thicknessMm: 15.8 },
      { brand: "Bremont", model: "FW44 Chrono", reference: "FW44 Chrono", lugToLugMm: 49, caseMm: 43, thicknessMm: 15.8 },
      { brand: "Bremont", model: "FW44", reference: "FW44", lugToLugMm: 49, caseMm: 40, thicknessMm: 12.5 }
    )
  },
  {
    urlIncludes: "the-zodiac-super-sea-wolf-68-limited-edition",
    records: semanticRecords({ brand: "Zodiac", model: "Super Sea Wolf 68 Limited Edition", reference: "Super Sea Wolf 68 Limited Edition", lugToLugMm: 50, caseMm: 44 })
  },
  {
    urlIncludes: "urwerk-ur120-spock-review",
    records: semanticRecords({ brand: "Urwerk", model: "UR-120 Space Black", reference: "UR-120 Space Black", lugToLugMm: 44, caseMm: 47, thicknessMm: 15.8 })
  },
  {
    urlIncludes: "introducing-urwerk-ur-150-update",
    records: semanticRecords(
      { brand: "Urwerk", model: "UR-150 Scorpion Titan", reference: "UR-150 Scorpion Titan", lugToLugMm: 52.31, caseMm: 42.49, thicknessMm: 14.79 },
      { brand: "Urwerk", model: "UR-150 Scorpion Dark", reference: "UR-150 Scorpion Dark", lugToLugMm: 52.31, caseMm: 42.49, thicknessMm: 14.79 }
    )
  },
  {
    urlIncludes: "jaeger-lecoultre-updates-the-reverso-tribute-duoface-and-monoface-small-seconds",
    records: semanticRecords(
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Monoface Small Seconds", reference: "Q713216J", lugToLugMm: 45.6, caseMm: 27.4, thicknessMm: 7.56 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Duoface Small Seconds", reference: "Q398847J", lugToLugMm: 47, caseMm: 28.3, thicknessMm: 10.34 },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Duoface Small Seconds", reference: "Q3988481", lugToLugMm: 47, caseMm: 28.3, thicknessMm: 10.34 }
    )
  }
];

function overrideFor(url) {
  return structuredOverrides.find((override) => url.includes(override.urlIncludes));
}

for (const proposal of proposalFile.proposals) {
  const candidate = candidatesByUrl.get(normalizedUrl(proposal.url));
  if (!candidate) throw new Error(`Candidate missing for proposal: ${proposal.url}`);
  const rejected = rejectedReason(proposal.url);
  if (rejected) {
    report.excluded.push({ url: proposal.url, title: proposal.title, reason: rejected });
    continue;
  }
  if (proposal.action === "already-sourced") continue;

  const override = overrideFor(proposal.url);
  if (override) {
    for (const record of override.records) applyRecord(record, candidate);
    continue;
  }

  if (proposal.action === "conflict") {
    const references = proposal.references;
    for (const reference of references) {
      applyRecord(
        {
          brand: proposal.brand,
          model: proposal.model,
          reference,
          lugToLugMm: proposal.lugToLugMm,
          caseMm: proposal.caseMm,
          thicknessMm: proposal.thicknessMm,
          lugWidthMm: proposal.lugWidthMm,
          approximate: proposal.approximate
        },
        candidate
      );
    }
    continue;
  }

  // The proposal parser intentionally extracts conservative, punctuation-free
  // reference tokens. Preserve space-delimited references only for the two
  // manufacturers that publish them in that form; using whole fact-table
  // strings for every brand can accidentally retain color/strap prose.
  const spaceDelimitedReferenceBrand = /^(?:Oris|Blancpain)$/iu.test(proposal.brand);
  const factReferences = spaceDelimitedReferenceBrand ? referenceFactSegments(candidate) : [];
  const references = (factReferences.length ? factReferences : proposal.references).map((reference) =>
    reference.replace(/^(?:(?:Arctic|Pacific|Atlantic|Indian|Antarctic) )?Ocean\//iu, "")
  );
  const baseRecord = {
    brand: proposal.brand,
    model: proposal.model,
    lugToLugMm: proposal.lugToLugMm,
    caseMm: proposal.caseMm,
    thicknessMm: proposal.thicknessMm,
    lugWidthMm: proposal.lugWidthMm,
    approximate: proposal.approximate
  };
  if (!references.length) {
    applyRecord({ ...baseRecord, referenceIsFallback: true }, candidate);
  } else {
    for (let reference of references) {
      if (/^Richard Mille$/iu.test(proposal.brand) && !/^RM\b/iu.test(reference)) reference = `RM ${reference}`;
      applyRecord({ ...baseRecord, reference }, candidate);
    }
  }
}

// An early broad fallback matched a Black Bay Chrono article to two unrelated
// Black Bay references. Keep the cleanup here so rerunning the importer also
// repairs seeds produced by that earlier review-table revision.
const blackBayChronoSourceUrl = "https://www.hodinkee.com/articles/tudor-black-bay-chrono-hits-its-stride-hands-on";
for (const id of [4969, 4976]) {
  const watch = watches.find((candidate) => candidate.id === id);
  if (!watch) continue;
  const sourceCount = watch.sources.length;
  watch.sources = watch.sources.filter((source) => normalizedUrl(source.sourceUrl) !== blackBayChronoSourceUrl);
  if (watch.sources.length !== sourceCount) {
    report.sourceCorrections.push({ id: watch.id, reference: watch.reference, removedSourceUrl: blackBayChronoSourceUrl });
  }
}

// Corrections where the exact HODINKEE article resolves a demonstrably mixed
// seed row rather than merely adding another source.
const pelagosCandidate = summary.candidates.find((candidate) => candidate.url.includes("tudor-goes-full-less-is-more-with-the-pelagos-39"));
const pelagos = watches.find((watch) => watch.id === 4966);
if (pelagosCandidate && pelagos) {
  const before = { lugToLugMm: pelagos.lugToLugMm, caseMm: pelagos.caseMm, thicknessMm: pelagos.thicknessMm };
  const changed = before.lugToLugMm !== 47 || before.caseMm !== 39 || before.thicknessMm !== 11.8;
  pelagos.lugToLugMm = 47;
  pelagos.caseMm = 39;
  pelagos.thicknessMm = 11.8;
  report.conflicts = report.conflicts.filter((conflict) => conflict.id !== pelagos.id);
  appendSource(
    pelagos,
    pelagosCandidate,
    "Hodinkee identifies the Pelagos 39 as reference 25407N and reports 39mm width, 11.8mm thickness, and 47mm lug-to-lug."
  );
  if (changed) {
    report.corrected.push({ id: pelagos.id, reference: pelagos.reference, before, after: { lugToLugMm: 47, caseMm: 39, thicknessMm: 11.8 } });
  }
}

const ploprofCandidate = summary.candidates.find((candidate) =>
  candidate.url.includes("an-iwc-ingenieur-ref-iw3506-from-the-80s")
);
const ploprof = watches.find((watch) => watch.id === 4772);
if (ploprofCandidate && ploprof) {
  const before = { lugToLugMm: ploprof.lugToLugMm, caseMm: ploprof.caseMm, thicknessMm: ploprof.thicknessMm };
  const changed = before.lugToLugMm !== 48 || before.caseMm !== 55;
  ploprof.lugToLugMm = 48;
  ploprof.caseMm = 55;
  report.conflicts = report.conflicts.filter((conflict) => conflict.id !== ploprof.id);
  appendSource(
    ploprof,
    ploprofCandidate,
    "Hodinkee describes this titanium Ploprof as 55mm across the case and 48mm along its compact lug-to-lug axis, resolving transposed seed dimensions."
  );
  if (changed) {
    report.corrected.push({
      id: ploprof.id,
      reference: ploprof.reference,
      before,
      after: { lugToLugMm: 48, caseMm: 55, thicknessMm: ploprof.thicknessMm }
    });
  }
}

function findManualCandidate(definition) {
  const matches = summary.candidates.filter((candidate) => {
    if (definition.urlEquals && normalizedUrl(candidate.url) !== normalizedUrl(definition.urlEquals)) return false;
    if (definition.urlIncludes && !candidate.url.includes(definition.urlIncludes)) return false;
    if (definition.titleIncludes && !normalize(candidate.title).includes(normalize(definition.titleIncludes))) return false;
    return true;
  });
  if (matches.length !== 1) {
    return { error: `Expected one candidate for ${definition.urlIncludes ?? definition.titleIncludes}, found ${matches.length}` };
  }
  return { candidate: matches[0] };
}

const manualDefinitions = [
  {
    titleIncludes: "7 Summer Watches That Can Handle The Heat",
    records: [{ brand: "Synchron", model: "Military", lugToLugMm: 45, caseMm: 42, thicknessMm: 14 }]
  },
  {
    urlIncludes: "the-nivada-grenchen-antarctic-gmt-limited-edition-for-hodinkee",
    records: [{ brand: "Nivada Grenchen", model: "Antarctic GMT Hodinkee Limited Edition", lugToLugMm: 40, caseMm: 36, thicknessMm: 11.1 }]
  },
  {
    urlIncludes: "the-longines-zulu-time-limited-edition-for-hodinkee",
    records: [{ brand: "Longines", model: "Spirit Zulu Time Limited Edition for Hodinkee", reference: "L38021596", lugToLugMm: 46.7, caseMm: 39, thicknessMm: 13.5 }]
  },
  {
    urlIncludes: "movado-innovation",
    records: ["0607553", "0607645"].map((reference) => ({ brand: "Movado", model: "SE Automatic", reference, lugToLugMm: 44.5, caseMm: 41, thicknessMm: 11.5 }))
  },
  {
    urlIncludes: "the-doxa-sub-army-200t-for-hodinkee-limited-edition",
    records: [{ brand: "Doxa", model: "SUB 200T Army Limited Edition for Hodinkee", lugToLugMm: 41.5, caseMm: 39, thicknessMm: 10.7 }]
  },
  {
    urlIncludes: "girard-perregaux-1966-wwtc-review",
    records: [{ brand: "Girard-Perregaux", model: "1966 WW.TC", lugToLugMm: 46, caseMm: 40, thicknessMm: 12 }]
  },
  {
    urlIncludes: "farer-37mm-hand-wound-stanhope-hands-on",
    records: [{ brand: "Farer", model: "Stanhope", lugToLugMm: 39.5, caseMm: 37, thicknessMm: 10.3 }]
  },
  {
    urlIncludes: "seiko-prospex-srpc44-diver-gold-hands-on",
    records: [{ brand: "Seiko", model: "Prospex SRPC44", reference: "SRPC44", lugToLugMm: 47.25, caseMm: 44.3, thicknessMm: 13.3 }]
  },
  {
    titleIncludes: "Orion Calamity",
    records: [{ brand: "Orion", model: "Calamity", lugToLugMm: 48, caseMm: 40, thicknessMm: 11.3 }]
  },
  {
    titleIncludes: "Serica W.W.W. William Brown",
    records: [{ brand: "Serica", model: "W.W.W. William Brown", lugToLugMm: 46.5, caseMm: 37.7, thicknessMm: 11.85 }]
  },
  {
    urlIncludes: "schon-horology-dot-prismatic-cardinal-hands-on",
    records: [
      { brand: "Schön DSGN", model: "Dot Prismatic", lugToLugMm: 47, caseMm: 37, thicknessMm: 9, lugWidthMm: 18 },
      { brand: "Schön DSGN", model: "Dot Cardinal", lugToLugMm: 47, caseMm: 37, thicknessMm: 9, lugWidthMm: 18 }
    ]
  },
  {
    titleIncludes: "Santos de Cartier Skeleton ADLC Noctambule",
    records: [{ brand: "Cartier", model: "Santos de Cartier Skeleton Noctambule", lugToLugMm: 47.7, caseMm: 39.8, thicknessMm: 9.08 }]
  },
  {
    titleIncludes: "Bremont Arrow",
    records: [{ brand: "Bremont", model: "Arrow", lugToLugMm: 51, caseMm: 42, thicknessMm: 15 }]
  },
  {
    titleIncludes: "Monta Atlas",
    records: [{ brand: "Monta", model: "Atlas", lugToLugMm: 47, caseMm: 38.5, thicknessMm: 10.2 }]
  },
  {
    titleIncludes: "Astor + Banks Sea Ranger",
    records: [{ brand: "Astor + Banks", model: "Sea Ranger", lugToLugMm: 45.5, caseMm: 40, thicknessMm: 13.8 }]
  },
  {
    urlIncludes: "the-bremont-argonaut-hands-on",
    records: [{ brand: "Bremont", model: "Argonaut", lugToLugMm: 49, caseMm: 42, thicknessMm: 15, allowUnparsed: true }]
  },
  {
    titleIncludes: "Detroit Watch Company M1-Woodward",
    records: [{ brand: "Detroit Watch Company", model: "M1-Woodward", lugToLugMm: 52, caseMm: 42, thicknessMm: 14.5 }]
  },
  {
    titleIncludes: "Buren MinStop",
    records: [{ brand: "Buren", model: "MinStop", lugToLugMm: 42, caseMm: 37, thicknessMm: 12.5 }]
  },
  {
    urlIncludes: "five-ways-to-rock-two-tone",
    records: [{ brand: "Zodiac", model: "Super Sea Wolf Two-Tone", lugToLugMm: 49, caseMm: 40, thicknessMm: 13 }]
  },
  {
    urlIncludes: "nivada-grenchen-new-versions-of-the-chronomaster-and-antarctic-introducing",
    records: [{ brand: "Nivada Grenchen", model: "Antarctic 38", lugToLugMm: 45, caseMm: 38, thicknessMm: 11.5 }]
  },
  {
    titleIncludes: "Tudor Black Bay Fifty-Eight Navy Blue",
    records: [{ brand: "Tudor", model: "Black Bay Fifty-Eight Navy Blue", reference: "M79030B-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.9 }]
  },
  {
    urlIncludes: "sinn-u50-hands-on",
    records: [{ brand: "Sinn", model: "U50", lugToLugMm: 47, caseMm: 41, thicknessMm: 11.15 }]
  },
  {
    titleIncludes: "Norqain Independence 20",
    records: [{ brand: "Norqain", model: "Independence 20", lugToLugMm: 48.75, caseMm: 42, thicknessMm: 11.8, lugWidthMm: 22 }]
  },
  {
    urlIncludes: "traversing-the-straight-and-narrow-with-a-grassroots-dive-watch",
    records: [{ brand: "Raven", model: "Trekker 39", lugToLugMm: 47.5, caseMm: 39, thicknessMm: 13 }]
  },
  {
    urlIncludes: "tudor-black-bay-fifty-eight-925-hands-on",
    records: [{ brand: "Tudor", model: "Black Bay Fifty-Eight 925", reference: "M79010SG-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 12.7 }]
  },
  {
    urlIncludes: "tudor-black-bay-fifty-eight-18k-hands-on",
    records: [{ brand: "Tudor", model: "Black Bay Fifty-Eight 18K", reference: "M79018V-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 12.7 }]
  },
  {
    urlIncludes: "the-man-trying-to-make-a-100-french-watch",
    records: [{ brand: "LIP", model: "Instantanée LIP by S&A", lugToLugMm: 44.5, caseMm: 37, thicknessMm: 9, allowUnparsed: true }]
  },
  {
    urlIncludes: "our-6-favorite-dive-watches-for-under-dollar1000",
    records: [{ brand: "Halios", model: "Fairwind", lugToLugMm: 48, caseMm: 39, thicknessMm: 12.4 }]
  },
  {
    urlIncludes: "all-three-versions-of-the-new-mbandf-lm101-2021-edition",
    records: [{ brand: "MB&F", model: "Legacy Machine 101 2021", lugToLugMm: 46.5, caseMm: 40, thicknessMm: 15.5 }]
  },
  {
    urlIncludes: "the-gorilla-fastback-thunderbolt-chronograph-celebrates-dubois-depraz",
    records: [{ brand: "Gorilla", model: "Fastback Thunderbolt", lugToLugMm: 57, caseMm: 44, thicknessMm: 13.8 }]
  },
  {
    urlIncludes: "sinn-hunting-chronograph-3006",
    records: [{ brand: "Sinn", model: "Hunting Chronograph 3006", lugToLugMm: 51, caseMm: 44, thicknessMm: 15.5 }]
  },
  {
    urlIncludes: "baltics-newest-watch-is-a-delightful-surprise",
    records: [{ brand: "Baltic", model: "MR01", lugToLugMm: 44, caseMm: 36, thicknessMm: 9.8 }]
  },
  {
    urlIncludes: "the-vostok-amphibia-scuba-dude-reference-420380",
    records: [{ brand: "Vostok", model: "Amphibia", reference: "420380", lugToLugMm: 45, caseMm: 39, thicknessMm: 15 }]
  },
  {
    titleIncludes: "Aquastar Deepstar II",
    records: [{ brand: "Aquastar", model: "Deepstar II", lugToLugMm: 46.5, caseMm: 37, thicknessMm: 13 }]
  },
  {
    titleIncludes: "Leica L2",
    records: [{ brand: "Leica", model: "L2", lugToLugMm: 47.5, caseMm: 41, thicknessMm: 14 }]
  },
  {
    urlIncludes: "iwcs-least-expensive-watch-is-also-secretly-its-most-significant",
    records: [{ brand: "IWC", model: "Pilot's Watch Automatic 36", lugToLugMm: 46, caseMm: 36, thicknessMm: 10.5 }]
  },
  {
    urlIncludes: "sinn-colorful-556-series-2022",
    records: [{ brand: "Sinn", model: "556 Limited Edition Colors", lugToLugMm: 45.5, caseMm: 38.5, thicknessMm: 11, allowUnparsed: true }]
  },
  {
    urlIncludes: "move-over-rugrats-baltics-5th-anniversary-watch-is-a-90s-kids-dream",
    records: [{ brand: "Baltic", model: "Aquascaphe Dual-Crown 5th Anniversary", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.9 }]
  },
  {
    titleIncludes: "Aquastar Deepstar 39mm",
    records: [{ brand: "Aquastar", model: "Deepstar 39", lugToLugMm: 48.5, caseMm: 39, thicknessMm: 16.5 }]
  },
  {
    titleIncludes: "Oris Hölstein Edition 2022",
    records: [{ brand: "Oris", model: "Hölstein Edition 2022", lugToLugMm: 43, caseMm: 36.5, thicknessMm: 12 }]
  },
  {
    titleIncludes: "Orient Bambino",
    records: [{ brand: "Orient", model: "Bambino Version 2", reference: "FAC00008W0", lugToLugMm: 46.8, caseMm: 40.5, thicknessMm: 11.8, lugWidthMm: 21 }]
  },
  {
    urlIncludes: "collectible-1990s-watches-rolex-patek-daniel-roth",
    records: [{ brand: "Patek Philippe", model: "Perpetual Calendar", reference: "5040", lugToLugMm: 42, caseMm: 35, thicknessMm: 9 }]
  },
  {
    urlIncludes: "panda-and-reverse-panda-baltic-delivers-the-chronograph-youve-been-asking-for",
    records: [{ brand: "Baltic", model: "Tricompax", lugToLugMm: 47, caseMm: 39.5, thicknessMm: 13.5 }]
  },
  {
    urlIncludes: "seiko-circles-back-on-a-classic-design-with-another-killer-prospex-re-interpretation-spb313-spb315-a",
    records: ["SPB313", "SPB315", "SPB317"].map((reference) => ({ brand: "Seiko", model: "Prospex Slim Turtle", reference, lugToLugMm: 46.9, caseMm: 41, thicknessMm: 12.3, allowUnparsed: true }))
  },
  {
    urlIncludes: "this-is-the-ultimate-do-it-all-grand-seiko-spring-drive-gmt",
    records: [{ brand: "Grand Seiko", model: "Sport Collection GMT", reference: "SBGE253", lugToLugMm: 48.6, caseMm: 40.5, thicknessMm: 14.7 }]
  },
  {
    urlIncludes: "bremont-builds-heat-with-the-supernova",
    records: [{ brand: "Bremont", model: "Supernova", lugToLugMm: 53, caseMm: 40, thicknessMm: 11.1 }]
  },
  {
    urlIncludes: "a-little-modernity-goes-a-long-way-for-the-zodiac-super-seawolf-ceramic",
    records: [{ brand: "Zodiac", model: "Super Sea Wolf Ceramic", reference: "ZO9595", lugToLugMm: 51.3, caseMm: 40, thicknessMm: 13.5, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "toolish-titanium-timing-with-tudor-and-scurfa",
    records: [{ brand: "Scurfa", model: "Diver One Titanium", lugToLugMm: 47.7, caseMm: 40, thicknessMm: 14.4 }]
  },
  {
    titleIncludes: "Porsche Design Chronograph 1 GP 2023",
    records: [{ brand: "Porsche Design", model: "Chronograph 1 GP 2023", lugToLugMm: 45, caseMm: 40.8, thicknessMm: 14.15 }]
  },
  {
    titleIncludes: "Synchron Poseidon",
    records: [{ brand: "Synchron", model: "Poseidon", lugToLugMm: 45.3, caseMm: 42, thicknessMm: 14.3 }]
  },
  {
    titleIncludes: "Raven Vintage Gold",
    records: [{ brand: "Raven", model: "Vintage Gold", lugToLugMm: 48.5, caseMm: 39, thicknessMm: 13.4 }]
  },
  {
    titleIncludes: "Aquastar Model 60",
    records: [{ brand: "Aquastar", model: "Model 60", lugToLugMm: 47.1, caseMm: 37, thicknessMm: 12.6 }]
  },
  {
    urlIncludes: "the-richard-mille-rm-66-flying-tourbillon-is-a-handsome-devil-video",
    records: [{ brand: "Richard Mille", model: "RM 66 Flying Tourbillon", reference: "RM 66", lugToLugMm: 49.94, caseMm: 42.7, thicknessMm: 16.5, allowUnparsed: true }]
  },
  {
    titleIncludes: "TAG Heuer Carrera Skipper",
    records: [{ brand: "TAG Heuer", model: "Carrera Skipper", lugToLugMm: 46, caseMm: 39, thicknessMm: 13.9 }]
  },
  {
    urlIncludes: "hands-on-furlan-marri-three-hands",
    records: [{ brand: "Furlan Marri", model: "Three-Hand", lugToLugMm: 46, caseMm: 37.5, thicknessMm: 10.5 }]
  },
  {
    urlIncludes: "hands-on-nivada-tropical-chronomaster",
    records: [{ brand: "Nivada Grenchen", model: "Tropical Chronomaster", lugToLugMm: 46.5, caseMm: 38, thicknessMm: 13.75 }]
  },
  {
    urlIncludes: "the-lorier-hydra-siii",
    records: [{ brand: "Lorier", model: "Hydra Series III", lugToLugMm: 46, caseMm: 41, thicknessMm: 14.6 }]
  },
  {
    urlIncludes: "panerai-radiomir-quaranta-review",
    records: [{ brand: "Panerai", model: "Radiomir Quaranta", lugToLugMm: 48, caseMm: 40, thicknessMm: 10.8 }]
  },
  {
    titleIncludes: "Rallymaster II",
    records: [{ brand: "Maurice de Mauriac x Racquet", model: "Rallymaster II", lugToLugMm: 47, caseMm: 39, thicknessMm: 12 }]
  },
  {
    titleIncludes: "Chronomètre Antimagnétique",
    records: [{ brand: "Rexhep Rexhepi", model: "Chronomètre Antimagnétique", lugToLugMm: 48, caseMm: 38, thicknessMm: 9.9, lugWidthMm: 20 }]
  },
  {
    titleIncludes: "Leica ZM 11",
    records: [{ brand: "Leica", model: "ZM 11", lugToLugMm: 45.3, caseMm: 41, thicknessMm: 13 }]
  },
  {
    urlIncludes: "hands-on-baltic-x-perpetuel-gallery-tropical-tricompax",
    records: [{ brand: "Baltic", model: "Tropical Tricompax", lugToLugMm: 47, caseMm: 39.5, thicknessMm: 13.5 }]
  },
  {
    titleIncludes: "Citizen Series 8 GMT",
    records: [{ brand: "Citizen", model: "Series 8 GMT", lugToLugMm: 47.8, caseMm: 41, thicknessMm: 13.8 }]
  },
  {
    urlIncludes: "did-raymond-weil-really-make-a-watch-for-watch-enthusiasts",
    records: [{ brand: "Raymond Weil", model: "Millésime Small Seconds", reference: "2930-STC-65001", lugToLugMm: 46, caseMm: 39.5, thicknessMm: 10.25 }]
  },
  {
    urlIncludes: "hands-on-furlan-marri-revolution-montanari-mechanical-chronograph",
    records: [{ brand: "Furlan Marri", model: "Flyback Chronograph", reference: "3177-A", lugToLugMm: 46, caseMm: 38, thicknessMm: 13.2 }]
  },
  {
    titleIncludes: "Longines Master Collection Small Seconds",
    records: ["L2.843.4.93.2", "L2.843.4.63.2", "L2.843.4.73.2"].map((reference) => ({
      brand: "Longines",
      model: "Master Collection Small Seconds",
      reference,
      lugToLugMm: 45,
      caseMm: 38.5,
      thicknessMm: 10.2,
      lugWidthMm: 20
    }))
  },
  {
    urlIncludes: "one-to-watch-fleming",
    records: [{ brand: "Fleming", model: "Series 1", lugToLugMm: 46.5, caseMm: 38.5, thicknessMm: 9 }]
  },
  {
    urlIncludes: "hands-on-baltic-tour-auto-2024",
    records: [{ brand: "Baltic", model: "Tricompax Tour Auto 2024", lugToLugMm: 47, caseMm: 39.5, thicknessMm: 13.5, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "hands-on-fp-journe-elegante-ginos-dream",
    records: [{ brand: "F.P. Journe", model: "Élégante Gino's Dream", lugToLugMm: 48, caseMm: 40, thicknessMm: 7.95 }]
  },
  {
    titleIncludes: "TAG Heuer Formula 1 Kith",
    records: [{ brand: "TAG Heuer", model: "Formula 1 Kith", lugToLugMm: 40, caseMm: 35, thicknessMm: 9.45 }]
  },
  {
    urlIncludes: "introducing-naoya-hida-2024",
    records: [{ brand: "Naoya Hida & Co.", model: "Type 5A", lugToLugMm: 43.5, caseMm: 26, thicknessMm: 9.1 }]
  },
  {
    urlIncludes: "swatch-adds-six-watches-to-its-neon-collection-just-in-time-for-summer",
    records: [{ brand: "Swatch", model: "Neon Wave", lugToLugMm: 49, caseMm: 42, thicknessMm: 13 }]
  },
  {
    urlIncludes: "new-watches-from-merci-x-tracksmith-and-maurice-de-mauriac-x-racquet",
    records: [{ brand: "Merci Instruments x Tracksmith", model: "Runaway", lugToLugMm: 47, caseMm: 38, thicknessMm: 12 }]
  },
  {
    urlIncludes: "new-watches-from-merci-x-tracksmith-and-maurice-de-mauriac-x-racquet",
    records: [{ brand: "Maurice de Mauriac x Racquet", model: "Rallymaster III", lugToLugMm: 47, caseMm: 39, thicknessMm: 12 }]
  },
  {
    urlIncludes: "hands-on-madeditions-mad1s",
    records: [{ brand: "M.A.D. Editions", model: "M.A.D.1S", lugToLugMm: 50.5, caseMm: 42, thicknessMm: 18.8 }]
  },
  {
    titleIncludes: "Berneron Mirage",
    records: [{ brand: "Berneron", model: "Mirage", lugToLugMm: 42, caseMm: 34, thicknessMm: 7 }]
  },
  {
    urlIncludes: "hands-on-dennison-ald-collection",
    records: [{ brand: "Dennison", model: "ALD Collection", lugToLugMm: 37, caseMm: 33.64, thicknessMm: 6.05 }]
  },
  {
    titleIncludes: "Omega Speedmaster Pilot",
    records: [{ brand: "Omega", model: "Speedmaster Pilot", lugToLugMm: 49.6, caseMm: 40.85, thicknessMm: 14.54 }]
  },
  {
    urlIncludes: "hands-on-simon-brette-chronometre-aristans-rose",
    records: [{ brand: "Simon Brette", model: "Chronomètre Artisans Rose Gold", lugToLugMm: 45, caseMm: 39, thicknessMm: 10.3, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "hands-on-mbandf-x-bulgari-serpenti",
    records: [{ brand: "Bulgari x MB&F", model: "Serpenti", lugToLugMm: 53, caseMm: 39, thicknessMm: 18 }]
  },
  {
    titleIncludes: "Citizen Promaster Land U822",
    records: [{ brand: "Citizen", model: "Promaster Land U822", lugToLugMm: 51.4, caseMm: 44, thicknessMm: 14.5 }]
  },
  {
    titleIncludes: "F.P. Journe Chronomètre Souverain 20th Anniversary",
    records: [{ brand: "F.P. Journe", model: "Chronomètre Souverain 20th Anniversary", lugToLugMm: 48, caseMm: 40, thicknessMm: 8 }]
  },
  {
    urlIncludes: "hands-on-rolex-alcaraz-daytona",
    records: [{ brand: "Rolex", model: "Cosmograph Daytona Carlos Alcaraz", reference: "126518LN", lugToLugMm: 47.5, caseMm: 40, thicknessMm: 11.4 }]
  },
  {
    titleIncludes: "Atelier Wen Ancestra",
    records: [{ brand: "Atelier Wen", model: "Ancestra", lugToLugMm: 46, caseMm: 38, thicknessMm: 11.3 }]
  },
  {
    urlIncludes: "the-wren-diver-38",
    records: [{ brand: "Wren", model: "Diver One", lugToLugMm: 45, caseMm: 38, thicknessMm: 10.7 }]
  },
  {
    urlIncludes: "paulin-dives-into-tool-watch-design-with-the-mara",
    records: [{ brand: "Paulin", model: "Mara", lugToLugMm: 48, caseMm: 39.7, thicknessMm: 13.5 }]
  },
  {
    urlIncludes: "studio-underd0g-and-fears-reveal-the-next-entry-in-their-cocktail-inspired-series-with-the-02series",
    records: [{ brand: "Studio Underd0g x Fears", model: "02Series Manhattan", lugToLugMm: 43.5, caseMm: 38, thicknessMm: 12 }]
  },
  {
    titleIncludes: "RZE Resolute 36",
    records: [{ brand: "RZE", model: "Resolute 36", lugToLugMm: 42.3, caseMm: 36, thicknessMm: 9.5 }]
  },
  {
    titleIncludes: "Atelier Wen Inflection",
    records: [{ brand: "Atelier Wen", model: "Inflection", lugToLugMm: 45, caseMm: 40, thicknessMm: 10.25 }]
  },
  {
    urlIncludes: "echoneutra-combines-brutalism-and-compact-elegance-to-create-the-rivanera-piccolo",
    records: [{ brand: "Echo/Neutra", model: "Rivanera Piccolo", lugToLugMm: 33, caseMm: 26, thicknessMm: 5.9 }]
  },
  {
    urlIncludes: "meet-quiet-club-and-the-debut-watch-that-offers-a-new-way-of-thinking-about-time",
    records: [{ brand: "Quiet Club", model: "F39", lugToLugMm: 44, caseMm: 40.3, thicknessMm: 12 }]
  },
  {
    titleIncludes: "Zenith Defy Revival A3643",
    records: [{ brand: "Zenith", model: "Defy Revival A3643", reference: "A3643", lugToLugMm: 42, caseMm: 37, thicknessMm: 14 }]
  },
  {
    titleIncludes: "Isotope Moonshot",
    records: [{ brand: "Isotope", model: "Moonshot", lugToLugMm: 49.5, caseMm: 41, thicknessMm: 15 }]
  },
  {
    urlIncludes: "niton-relaunch-2026",
    records: [{ brand: "Niton", model: "Prima", lugToLugMm: 42, caseMm: 27, thicknessMm: 7.9 }]
  },
  {
    titleIncludes: "Ardra Labs Delta Type",
    records: [{ brand: "Ardra Labs", model: "Delta Type", lugToLugMm: 47, caseMm: 39, thicknessMm: 11 }]
  },
  {
    urlIncludes: "the-citizen-tsuyosa-secondeseconde",
    records: [{ brand: "Citizen", model: "Tsuyosa x seconde/seconde", lugToLugMm: 44.8, caseMm: 40, thicknessMm: 11.8 }]
  },
  {
    urlIncludes: "hands-on-temporal-works-series-a-rambler",
    records: [{ brand: "Temporal Works", model: "Rambler", lugToLugMm: 45, caseMm: 37, thicknessMm: 10 }]
  },
  {
    titleIncludes: "Vacheron Constantin Twin Beat",
    records: [{ brand: "Vacheron Constantin", model: "Traditionnelle Twin Beat", lugToLugMm: 48.7, caseMm: 44, thicknessMm: 14.1 }]
  },
  {
    urlIncludes: "hands-on-breguet-classique-tourbillon",
    records: [{ brand: "Breguet", model: "Classique 7357", reference: "7357", lugToLugMm: 43, caseMm: 35, thicknessMm: 8.9 }]
  },
  {
    urlIncludes: "aera-watches-a-young-british-brand-making-the-tool-watch-feel-contemporary",
    records: [
      { brand: "Aera", model: "D-1 Diver", lugToLugMm: 49.8, caseMm: 42, thicknessMm: 16 },
      { brand: "Aera", model: "P-1 Pilot", lugToLugMm: 49.8, caseMm: 43, thicknessMm: 15 }
    ]
  },
  {
    urlIncludes: "casio-ae1500-value-proposition",
    records: [{ brand: "Casio", model: "AE-1500", reference: "AE-1500", lugToLugMm: 54.4, caseMm: 51.2, thicknessMm: 15.7 }]
  },
  {
    urlIncludes: "cornell-watch-co-aims-to-put-a-spotlight-on-american-watchmaking",
    records: [{ brand: "Cornell Watch Co.", model: "1870 C.E.", lugToLugMm: 48, caseMm: 39, thicknessMm: 11.3 }]
  },
  {
    urlIncludes: "hands-on-mbandf-lm101-evo",
    records: [{ brand: "MB&F", model: "LM101 EVO", lugToLugMm: 49, caseMm: 40, thicknessMm: 16.5, lugWidthMm: 17 }]
  },
  {
    urlIncludes: "hands-on-retro-furlan-marri-disco-volante",
    records: [{ brand: "Furlan Marri", model: "Disco Volante", lugToLugMm: 32, caseMm: 38, thicknessMm: 8.95, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "hands-on-with-the-h-moser-and-cie-x-alpine-motorsports",
    records: [{ brand: "H. Moser & Cie.", model: "Streamliner Cylindrical Tourbillon Skeleton Alpine Drivers Edition", lugToLugMm: 45, caseMm: 42.3 }]
  },
  {
    urlIncludes: "introducing-ming-3708-aventurine",
    records: [{ brand: "Ming", model: "37.08 Starlight", reference: "37.08", lugToLugMm: 45.5, caseMm: 38, thicknessMm: 10.9, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "introducing-the-limited-edition-patek-philippe-chiming-jump-hour-reference-5275",
    records: [{ brand: "Patek Philippe", model: "Chiming Jump Hour", reference: "5275P-001", lugToLugMm: 47.4, caseMm: 39.8, thicknessMm: 11.3 }]
  },
  {
    urlIncludes: "its-time-for-a-real-life-look-at-the-new-38mm-hamilton-murph",
    records: ["H70405730", "H70405130", "H70405710"].map((reference) => ({
      brand: "Hamilton",
      model: "Khaki Field Murph 38mm",
      reference,
      lugToLugMm: 44.7,
      caseMm: 38,
      thicknessMm: 11.1,
      lugWidthMm: 20,
      allowUnparsed: true
    }))
  },
  {
    urlIncludes: "longines-heritage-skin-diver-hands-on",
    records: [{ brand: "Longines", model: "Heritage Skin Diver", lugToLugMm: 52.55, caseMm: 42, thicknessMm: 13.75 }]
  },
  {
    urlIncludes: "maen-hudson-38-automatic-hands-on",
    records: [{ brand: "Maen", model: "Hudson 38 Automatic", reference: "Hudson 38 Automatic", lugToLugMm: 45, caseMm: 38, thicknessMm: 12, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "nomos-glashutte-introduces-the-tangente-2date-with-a-brand-new-movement",
    records: [{ brand: "NOMOS Glashütte", model: "Tangente 2date", lugToLugMm: 47.7, caseMm: 37.5, thicknessMm: 6.8 }]
  },
  {
    urlIncludes: "omega-seamaster-planet-ocean-36th-americas-cup-limited-edition-hands-on",
    records: [{ brand: "Omega", model: "Seamaster Planet Ocean 36th America's Cup Limited Edition", reference: "215.32.43.21.04.001", lugToLugMm: 44.8, caseMm: 43.5, thicknessMm: 16.04 }]
  },
  {
    urlIncludes: "oris-aquis-date-caliber-400-introducing",
    records: [{ brand: "Oris", model: "Aquis Date Calibre 400", lugToLugMm: 49, caseMm: 43.5, thicknessMm: 13 }]
  },
  {
    urlIncludes: "oris-divers-sixty-five-chronograph-holstein-edition-2020-hands-on",
    records: [{ brand: "Oris", model: "Divers Sixty-Five Chronograph Hölstein Edition 2020", lugToLugMm: 51, caseMm: 43, thicknessMm: 16, lugWidthMm: 21 }]
  },
  {
    urlIncludes: "patek-phillipe-aquanaut-travel-time-ref-5164r-hands-on",
    records: [{ brand: "Patek Philippe", model: "Aquanaut Travel Time", reference: "5164R-001", lugToLugMm: 48, caseMm: 40.8, thicknessMm: 10.2 }]
  },
  {
    urlIncludes: "rethinking-a-classic-recipe-with-the-dietrich-skin-diver-sd-1",
    records: [{ brand: "Dietrich", model: "Skin Diver SD-1", reference: "SD-1", lugToLugMm: 46.2, caseMm: 38.5, thicknessMm: 12, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "seiko-prospex-snj025-aka-the-2019-arnie-hands-on",
    records: [{ brand: "Seiko", model: "Prospex Arnie", reference: "SNJ025", lugToLugMm: 51.3, caseMm: 47.8, thicknessMm: 14.4, lugWidthMm: 22 }]
  },
  {
    urlIncludes: "sinn-updates-its-classic-103-chronograph-with-a-hand-wound-movement",
    records: [{ brand: "Sinn", model: "103 St Ty Hd", reference: "103 St Ty Hd", lugToLugMm: 47.5, caseMm: 41, thicknessMm: 14.8, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-bulgari-octo-finissimo-automatic-blasted-gold",
    records: [{ brand: "Bulgari", model: "Octo Finissimo Automatic Blasted Gold", lugToLugMm: 45, caseMm: 40, thicknessMm: 5.15 }]
  },
  {
    urlIncludes: "the-bulova-oceanographer-gmt",
    records: [{ brand: "Bulova", model: "Oceanographer GMT", reference: "Oceanographer GMT", lugToLugMm: 45.2, caseMm: 41, thicknessMm: 14.6, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-classically-versatile-victorinox-swiss-army-heritage",
    records: [{ brand: "Victorinox", model: "Swiss Army Heritage", reference: "241968", lugToLugMm: 49, caseMm: 40, thicknessMm: 9, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-grand-seiko-soko-special-edition-sees-the-forest-for-the-trees",
    records: [{ brand: "Grand Seiko", model: "Soko Shadow Special Edition", reference: "SBGA429", lugToLugMm: 47, caseMm: 39, thicknessMm: 12.3 }]
  },
  {
    urlIncludes: "the-ianos-dytis-diver",
    records: [{ brand: "Ianos", model: "Dytis", lugToLugMm: 49, caseMm: 41, thicknessMm: 14.68 }]
  },
  {
    urlIncludes: "the-incredibly-precise-longines-ultra-chron-dive-watch-punches-way-above-its-price-point",
    records: [{ brand: "Longines", model: "Ultra-Chron Dive Watch", lugToLugMm: 48, caseMm: 43, thicknessMm: 13.6 }]
  },
  {
    urlIncludes: "the-jaeger-lecoultre-reverso-tribute-chronograph-2",
    records: ["Q389257J", "Q389848J"].map((reference) => ({ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Chronograph", reference, lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.14, allowUnparsed: true }))
  },
  {
    urlIncludes: "the-le-forban-marseillaise-with-what-might-just-be-a-first-the-dive-bund",
    records: [{ brand: "Le Forban", model: "Marseillaise", lugToLugMm: 46, caseMm: 40.8, thicknessMm: 11.9, approximate: true }]
  },
  {
    urlIncludes: "the-momentum-atlas-automatic-is-lightweight-and-field-ready",
    records: [{ brand: "Momentum", model: "Atlas Automatic", lugToLugMm: 43, caseMm: 38, thicknessMm: 11.5, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-new-citizen-orca-is-whale-of-a-watch-for-less-than-dollar500",
    records: [{ brand: "Citizen", model: "Promaster Dive Orca", lugToLugMm: 50, caseMm: 46, thicknessMm: 14.6 }]
  },
  {
    urlIncludes: "the-oris-yangtze-jiangtun-limited-edition",
    records: [{ brand: "Oris", model: "Aquis Date Yangtze Jiangtun Limited Edition", lugToLugMm: 51, caseMm: 43.5, thicknessMm: 13.1 }]
  },
  {
    urlIncludes: "the-swatch-and-keith-haring-from-the-archive",
    records: [{ brand: "Swatch", model: "Break Free From The Archive", reference: "SO29Z145", lugToLugMm: 47.4, caseMm: 41, thicknessMm: 9.85 }]
  },
  {
    urlIncludes: "the-tag-heuer-x-fragment-design-glassbox-carrera-is-a-masterclass-in-collaboration",
    records: [{ brand: "TAG Heuer", model: "Carrera Chronograph x Fragment", reference: "CBS221B.BA0045", lugToLugMm: 44.8, caseMm: 39, thicknessMm: 13.7 }]
  },
  {
    urlIncludes: "the-tudor-black-bay-pro-2",
    records: [{ brand: "Tudor", model: "Black Bay Pro", reference: "M79470", lugToLugMm: 47, caseMm: 39, thicknessMm: 14.6, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-watches-of-the-year-of-the-horse",
    records: [{ brand: "Jaeger-LeCoultre", model: "Reverso Tribute Enamel Year of the Horse", lugToLugMm: 45.6, caseMm: 29.9, thicknessMm: 9.73 }]
  },
  {
    urlIncludes: "hands-on-timex-world-time-1972",
    records: [{ brand: "Timex", model: "World Time 1972 Reissue", lugToLugMm: 41.5, caseMm: 39, thicknessMm: 12, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "victorinoxs-latest-titanium-diver-the-dive-pro",
    records: [{ brand: "Victorinox", model: "Dive Pro Quartz Titanium", lugToLugMm: 54.2, caseMm: 43, thicknessMm: 14, lugWidthMm: 21, allowUnparsed: true }]
  },
  {
    urlIncludes: "we-each-had-dollar100-to-spend-on-a-watch-heres-what-we-got",
    records: [{ brand: "Seiko", model: "Seiko 5", reference: "SNK803", lugToLugMm: 42.5, caseMm: 37, thicknessMm: 10 }]
  },
  {
    urlIncludes: "worn-and-wound-has-unearthed-new-old-stock-hamilton-khaki-fields-from-the-1980s",
    records: [{ brand: "Hamilton", model: "Khaki Field NOS 1980s", lugToLugMm: 40.5, caseMm: 33, thicknessMm: 10.6 }]
  },
  {
    urlIncludes: "our-favorite-watches-for-under-a-few-way-way-under-dollar1000",
    records: [{ brand: "Scurfa", model: "Treasure Seeker", lugToLugMm: 49, caseMm: 41, thicknessMm: 12.6, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "alpina-bumper-watch-review",
    records: [{ brand: "Alpina", model: "Startimer Pilot Heritage Manufacture", lugToLugMm: 40.75, caseMm: 41, allowUnparsed: true }]
  },
  {
    urlIncludes: "citizen-introduces-the-next-generation-of-promaster-skyhawk",
    records: [
      { brand: "Citizen", model: "Promaster Skyhawk U830 Blue", reference: "JV2000-51L", lugToLugMm: 48.4, caseMm: 43, thicknessMm: 13.9, allowUnparsed: true, noteSuffix: "The fitted bracelet end link extends the total wrist span to 53.3mm." },
      { brand: "Citizen", model: "Promaster Skyhawk U830 Grey", reference: "JV2006-55H", lugToLugMm: 48.4, caseMm: 43, thicknessMm: 13.9, allowUnparsed: true, noteSuffix: "The fitted bracelet end link extends the total wrist span to 53.3mm." },
      { brand: "Citizen", model: "Promaster Skyhawk U830 Black", reference: "JV2005-58E", lugToLugMm: 48.4, caseMm: 43, thicknessMm: 13.9, allowUnparsed: true, noteSuffix: "The fitted bracelet end link extends the total wrist span to 53.3mm." }
    ]
  },
  {
    urlIncludes: "introducing-furlan-marri-disco-onyx-live-pics",
    records: [{ brand: "Furlan Marri", model: "Disco Diamonds Onyx", lugToLugMm: 32, caseMm: 38, thicknessMm: 8.95, lugWidthMm: 20, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-casio-vintage-x-pac-man-a100wepc-1b",
    records: [{ brand: "Casio", model: "Vintage x Pac-Man", reference: "A100WEPC-1B", lugToLugMm: 40, caseMm: 32, thicknessMm: 9, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-de-rijke-and-co-capri-is-a-unique-take-on-the-rectangular-dress-watch",
    records: [{ brand: "De Rijke & Co.", model: "Capri", lugToLugMm: 38, caseMm: 28.5, thicknessMm: 6.5, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-jaeger-lecoultre-reverso-tribute-geographic",
    records: [
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Geographic Steel", reference: "Q714845J", lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.14, semantic: true },
      { brand: "Jaeger-LeCoultre", model: "Reverso Tribute Geographic Pink Gold", reference: "Q714256J", lugToLugMm: 49.4, caseMm: 29.9, thicknessMm: 11.14, semantic: true }
    ]
  },
  {
    urlIncludes: "the-ming-2201-gmt-just-in-time-for-getting-back-up-in-the-air",
    records: [{ brand: "Ming", model: "22.01 GMT", reference: "22.01", lugToLugMm: 43.9, caseMm: 38, thicknessMm: 10.7, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-mbandf-horological-machine-hm12-the-guardian-is-the-robot-and-watch-combo-of-your-dreams",
    records: [{ brand: "MB&F", model: "HM12 The Guardian", reference: "HM12", lugToLugMm: 49.3, caseMm: 43.6, thicknessMm: 13.8, semantic: true }]
  },
  {
    urlIncludes: "farer-refreshes-its-aqua-compressor-line-with-three-new-designs",
    records: [{ brand: "Farer", model: "Aqua Compressor 2026", lugToLugMm: 45, caseMm: 41, thicknessMm: 12.5, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-aquastar-benthos-professional",
    records: [{ brand: "Aquastar", model: "Benthos Professional", lugToLugMm: 47, caseMm: 42, thicknessMm: 13.9, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-aria-manufacture-chronometer-from-formex",
    records: ["0513.1.5033", "0513.1.5103", "0513.1.5133"].map((reference) => ({
      brand: "Formex",
      model: "Aria Manufacture Chronometer",
      reference,
      lugToLugMm: 45.45,
      caseMm: 40,
      thicknessMm: 6.9,
      allowUnparsed: true
    }))
  },
  {
    urlIncludes: "the-amida-digitrend-nasa-edition-launches-a-space-shuttle-inspired-driving-watch",
    records: [{ brand: "Amida", model: "Digitrend NASA Edition", reference: "LRD-04", lugToLugMm: 39, caseMm: 39.6, thicknessMm: 15.6, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-aera-c-1-chronograph",
    records: [
      { brand: "Aera", model: "C-1 Shadow Chronograph", lugToLugMm: 49.55, caseMm: 42, thicknessMm: 15.75, lugWidthMm: 22, allowUnparsed: true },
      { brand: "Aera", model: "C-1 Cloud Chronograph", lugToLugMm: 49.55, caseMm: 42, thicknessMm: 15.75, lugWidthMm: 22, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "a-snowy-take-on-the-fan-fave-omiwatari-leads-4-new-watches-from-grand-seiko",
    records: [
      { brand: "Grand Seiko", model: "Omiwatari", reference: "SBGY013", lugToLugMm: 43.7, caseMm: 38.5, thicknessMm: 10.2 },
      { brand: "Grand Seiko", model: "Elegance Manual Winding", reference: "SBGW281", lugToLugMm: 44.3, caseMm: 37.3, thicknessMm: 11.7 },
      { brand: "Grand Seiko", model: "Elegance Manual Winding", reference: "SBGW287", lugToLugMm: 44.3, caseMm: 37.3, thicknessMm: 11.7 },
      { brand: "Grand Seiko", model: "Evolution 9 Mt. Iwate Winter", reference: "SLGH019", lugToLugMm: 47, caseMm: 40, thicknessMm: 11.7 }
    ]
  },
  {
    urlIncludes: "breitling-unveils-its-first-perpetual-calendar-chronograph-movement",
    records: [
      { brand: "Breitling", model: "Premier B19 Datora 42 140th Anniversary", reference: "RB19401A1B1P1", lugToLugMm: 50, caseMm: 42, thicknessMm: 15.6 },
      { brand: "Breitling", model: "Navitimer B19 Chronograph 43 Perpetual Calendar 140th Anniversary", reference: "RB19101A1H1P1", lugToLugMm: 49, caseMm: 43, thicknessMm: 15.62 },
      { brand: "Breitling", model: "Super Chronomat B19 44 Perpetual Calendar 140th Anniversary", reference: "RB19301A1G1S1", lugToLugMm: 53.5, caseMm: 44, thicknessMm: 15.35 }
    ]
  },
  {
    urlIncludes: "christopher-ward-gives-its-core-sealander-collection-a-complete-redesign",
    records: [
      { brand: "Christopher Ward", model: "Sealander GMT 42", lugToLugMm: 48.5, caseMm: 42, thicknessMm: 11.5, lugWidthMm: 22 },
      { brand: "Christopher Ward", model: "Sealander GMT 36", lugToLugMm: 42, caseMm: 36, thicknessMm: 10.9, lugWidthMm: 20 }
    ]
  },
  {
    urlIncludes: "citizens-latest-titanium-dive-watch-is-neo-vintage-without-the-weight",
    records: [{ brand: "Citizen", model: "Promaster Mechanical Diver 200m Challenge Diver", lugToLugMm: 48.5, caseMm: 41, thicknessMm: 12.3, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "hands-on-baltic-hermetique-tourer",
    records: [{ brand: "Baltic", model: "Hermétique Tourer", lugToLugMm: 46, caseMm: 37, thicknessMm: 10.8, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "hands-on-defy-extreme-diver-shadow-and-defy-revival-diver-shadow",
    records: [
      { brand: "Zenith", model: "Defy Extreme Diver Shadow", reference: "97.9600.3620/21.I300", lugToLugMm: 47.4, caseMm: 42.5, thicknessMm: 15.5 },
      { brand: "Zenith", model: "Defy Revival Diver Shadow", reference: "97.A3648.670/21.M3648", lugToLugMm: 44, caseMm: 37, thicknessMm: 15.5 }
    ]
  },
  {
    urlIncludes: "intro-hanhart-417-ti-desert-pilot",
    records: [
      { brand: "Hanhart", model: "417 TI Desert Pilot 39", lugToLugMm: 46, caseMm: 39, thicknessMm: 13.6, lugWidthMm: 20 },
      { brand: "Hanhart", model: "417 TI Desert Pilot 42", lugToLugMm: 49, caseMm: 42, thicknessMm: 13.6, lugWidthMm: 21 }
    ]
  },
  {
    urlIncludes: "intro-naoya-hida-2026",
    records: [
      { brand: "Naoya Hida & Co.", model: "Type 2C-2", lugToLugMm: 44.8, caseMm: 37, thicknessMm: 11.4 },
      { brand: "Naoya Hida & Co.", model: "Type 7A", lugToLugMm: 43.8, caseMm: 36, thicknessMm: 11.7 },
      { brand: "Naoya Hida & Co.", model: "Type 8A", lugToLugMm: 38.4, caseMm: 31, thicknessMm: 8.9 }
    ]
  },
  {
    urlIncludes: "introducing-breguet-225th-tourbillons",
    records: [
      { brand: "Breguet", model: "Classique Tourbillon", reference: "7357PT", lugToLugMm: 43, caseMm: 35, thicknessMm: 9.2 },
      { brand: "Breguet", model: "Classique Tourbillon", reference: "7357BH", lugToLugMm: 43, caseMm: 35, thicknessMm: 9.2 },
      { brand: "Breguet", model: "Marine Tourbillon Équation Marchante", reference: "5887PT", lugToLugMm: 51.5, caseMm: 43.9, thicknessMm: 11.8 },
      { brand: "Breguet", model: "Classique Tourbillon Sidéral", reference: "7255PT", lugToLugMm: 47.6, caseMm: 38, thicknessMm: 10.2 },
      { brand: "Breguet", model: "Tradition Tourbillon", reference: "7047PT", lugToLugMm: 50.5, caseMm: 41, thicknessMm: 16 }
    ]
  },
  {
    urlIncludes: "introducing-kurono-tokyo-divers",
    records: [
      { brand: "Kurono Tokyo", model: "Diver's CS034P Inner Watch", reference: "CS034P", lugToLugMm: 37.4, caseMm: 35, thicknessMm: 9, lugWidthMm: 19 },
      { brand: "Kurono Tokyo", model: "Diver's CS034P With Dive Case", lugToLugMm: 56.7, caseMm: 46, thicknessMm: 13.5, lugWidthMm: 24 }
    ]
  },
  {
    urlIncludes: "introducing-nodus-duality-ii-drift-blue-contrail-gmt",
    records: [
      { brand: "Nodus", model: "Contrail GMT Evergreen", reference: "Contrail GMT", lugToLugMm: 46.6, caseMm: 40.5, thicknessMm: 11.8, lugWidthMm: 20 },
      { brand: "Nodus", model: "Duality II Drift Blue", reference: "Duality II Drift Blue", lugToLugMm: 48, caseMm: 40, thicknessMm: 11.5, lugWidthMm: 20 }
    ]
  },
  {
    urlIncludes: "nivada-grenchen-and-worn-and-wound-team-up-for-a-vintage-inspired-collab",
    records: [
      { brand: "Nivada Grenchen x Worn & Wound", model: "Chronomaster Valjoux 72", lugToLugMm: 46.5, caseMm: 38, thicknessMm: 14 },
      { brand: "Nivada Grenchen x Worn & Wound", model: "Datomaster VK64", lugToLugMm: 43.5, caseMm: 36, thicknessMm: 12 }
    ]
  },
  {
    urlIncludes: "seiko-announces-more-dive-gmts-are-coming-our-way-with-the-prospex-gmt",
    records: ["SPB381", "SPB383", "SPB385"].map((reference) => ({ brand: "Seiko", model: "Prospex 1968 Heritage Diver's GMT", reference, lugToLugMm: 48.6, caseMm: 42, thicknessMm: 12.9 }))
  },
  {
    urlIncludes: "seiko-prospex-spb077-spb079-hands-on",
    records: ["SPB077", "SPB079"].map((reference) => ({ brand: "Seiko", model: "Prospex 1968 Automatic Diver", reference, lugToLugMm: 51, caseMm: 44, thicknessMm: 13.1 }))
  },
  {
    urlIncludes: "seiko-prospex-spb143-spb145-spb147-and-spb149-introducing",
    records: ["SPB143", "SPB145", "SPB147", "SPB149"].map((reference) => ({ brand: "Seiko", model: "Prospex 1965 Diver's Modern Re-interpretation", reference, lugToLugMm: 47.6, caseMm: 40.5, thicknessMm: 13.2 }))
  },
  {
    urlIncludes: "tag-heuer-announces-high-tech-th-carbonspring-harispring",
    records: [
      { brand: "TAG Heuer", model: "Monaco Flyback Chronograph TH-Carbonspring", reference: "CBL5190.FT6313", lugToLugMm: 47.4, caseMm: 39, thicknessMm: 14.1 },
      { brand: "TAG Heuer", model: "Carrera Chronograph Tourbillon Extreme Sport TH-Carbonspring", lugToLugMm: 49.7, caseMm: 44, thicknessMm: 15.4 }
    ]
  },
  {
    urlIncludes: "tag-heuer-introduces-a-dark-blue-skeleton-monaco-in-dlc-titanium",
    records: [{ brand: "TAG Heuer", model: "Monaco Skeleton Dark Blue", reference: "CBL2188.FT6261", lugToLugMm: 47.4, caseMm: 39, thicknessMm: 15.2 }]
  },
  {
    urlIncludes: "the-16-story-of-24-hands-on-with-the-doxa-sub-200t",
    records: [{ brand: "Doxa", model: "SUB 200T", lugToLugMm: 41.5, caseMm: 39, thicknessMm: 10.7, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-next-generation-oris-aquis-date",
    records: [
      { brand: "Oris", model: "Aquis Date 43.5", lugToLugMm: 51, caseMm: 43.5, thicknessMm: 13.1 },
      { brand: "Oris", model: "Aquis Date 41.5", lugToLugMm: 49, caseMm: 41.5, thicknessMm: 12.9 },
      { brand: "Oris", model: "Aquis Date 36.5", lugToLugMm: 44, caseMm: 36.5, thicknessMm: 12.2 }
    ]
  },
  {
    urlIncludes: "the-oris-aquis-date-upcycle",
    records: [
      { brand: "Oris", model: "Aquis Date Upcycle 41.5", lugToLugMm: 47, caseMm: 41.5, thicknessMm: 13 },
      { brand: "Oris", model: "Aquis Date Upcycle 36.5", lugToLugMm: 42.5, caseMm: 36.5, thicknessMm: 12 }
    ]
  },
  {
    urlIncludes: "the-refreshed-oris-aquis-chronograph",
    records: [{ brand: "Oris", model: "Aquis Chronograph", reference: "01 771 7793 4155-07 8 23 01PEB", lugToLugMm: 51, caseMm: 43.5, thicknessMm: 16.2 }]
  },
  {
    urlIncludes: "the-santos-de-cartier-with-a-new-shiny-green-dial",
    records: [
      { brand: "Cartier", model: "Santos de Cartier Medium Green Dial", reference: "WSSA0061", lugToLugMm: 41.9, caseMm: 35.1, thicknessMm: 8.83 },
      { brand: "Cartier", model: "Santos de Cartier Large Green Dial", reference: "WSSA0062", lugToLugMm: 47.5, caseMm: 39.8, thicknessMm: 9.38 }
    ]
  },
  {
    urlIncludes: "the-tissot-prx-powermatic-80-now-finally-in-35mm",
    records: [{ brand: "Tissot", model: "PRX Powermatic 80 35mm", lugToLugMm: 39, caseMm: 35, thicknessMm: 10.9 }]
  },
  {
    urlIncludes: "the-tudor-pelagos-39-compromising-with-confidence",
    records: [{ brand: "Tudor", model: "Pelagos 39", reference: "M25407N-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.8 }]
  },
  {
    urlIncludes: "the-tudor-pelagos-39-is-this-the-dive-watch-weve-been-waiting-for",
    records: [{ brand: "Tudor", model: "Pelagos 39", reference: "M25407N-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.8 }]
  },
  {
    urlIncludes: "the-unimatic-series-8-now-in-black-live-pics",
    records: [
      { brand: "Unimatic", model: "Modello Uno Series 8", reference: "U1S-8B", lugToLugMm: 49, caseMm: 40, thicknessMm: 11.6, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Modello Due Series 8", reference: "U2S-8B", lugToLugMm: 47.5, caseMm: 38, thicknessMm: 11.6, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Modello Tre Series 8", reference: "U3S-8B", lugToLugMm: 51.2, caseMm: 41.5, thicknessMm: 12.9, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Modello Quattro Series 8", reference: "U4S-8B", lugToLugMm: 49, caseMm: 40, thicknessMm: 12.4, lugWidthMm: 22 }
    ]
  },
  {
    urlIncludes: "the-updated-breitling-avenger-takes-flight-with-a-chronograph-gmt-and-automatic-models",
    records: [
      { brand: "Breitling", model: "Avenger B01 Chronograph 44", lugToLugMm: 53, caseMm: 44, thicknessMm: 15.2 },
      { brand: "Breitling", model: "Avenger GMT 44", lugToLugMm: 53, caseMm: 44, thicknessMm: 12 },
      { brand: "Breitling", model: "Avenger Automatic 42", lugToLugMm: 51, caseMm: 42, thicknessMm: 12.1 }
    ]
  },
  {
    urlIncludes: "the-vivid-and-easy-wearing-new-34-and-38mm-omega-aqua-terras",
    records: [
      { brand: "Omega", model: "Seamaster Aqua Terra Shades 38mm", lugToLugMm: 45.1, caseMm: 38, thicknessMm: 12.26, lugWidthMm: 19 },
      { brand: "Omega", model: "Seamaster Aqua Terra Shades 34mm", lugToLugMm: 40.49, caseMm: 34, thicknessMm: 11.88, lugWidthMm: 16 }
    ]
  },
  {
    urlIncludes: "tired-of-color-doxas-whitepearl-dial-now-offered-for-its-entire-core-range",
    records: [
      { brand: "Doxa", model: "SUB 300 Carbon Whitepearl", lugToLugMm: 45, caseMm: 42.5, thicknessMm: 13.4 },
      { brand: "Doxa", model: "SUB 300T Whitepearl", lugToLugMm: 44.5, caseMm: 42.5, thicknessMm: 13.65 },
      { brand: "Doxa", model: "SUB 1500T Whitepearl", lugToLugMm: 47, caseMm: 45, thicknessMm: 16.25, lugWidthMm: 21 }
    ]
  },
  {
    urlIncludes: "tudor-re-establishes-its-territory-with-the-ranger-ref-79950",
    records: [{ brand: "Tudor", model: "Ranger", reference: "M79950-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 12, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "tudor-revitalizes-the-royal-in-40-36-and-30mm",
    records: [
      ...["2840D1A0", "2840D1A3"].map((reference) => ({ brand: "Tudor", model: "Royal 40", reference, lugToLugMm: 47, caseMm: 40, thicknessMm: 11.4 })),
      ...["2836C1A0", "2836C1S0", "2836C1A3"].map((reference) => ({ brand: "Tudor", model: "Royal 36", reference, lugToLugMm: 42.2, caseMm: 36, thicknessMm: 9.7 })),
      ...["2830C1A0", "2830C1S0", "2830C1A3"].map((reference) => ({ brand: "Tudor", model: "Royal 30", reference, lugToLugMm: 35.8, caseMm: 30, thicknessMm: 8.7 }))
    ]
  },
  {
    urlIncludes: "unimatic-lightens-up-with-three-new-titanium-releases",
    records: [
      { brand: "Unimatic", model: "Modello Uno GMT Titanium", reference: "U1S-TGMT", lugToLugMm: 49, caseMm: 41.5, thicknessMm: 11.6, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Modello Uno Titanium", reference: "U1S-T-MP", lugToLugMm: 49, caseMm: 41.5, thicknessMm: 11.6, lugWidthMm: 22 },
      { brand: "Unimatic", model: "Modello Due Titanium", reference: "U2S-T-MP", lugToLugMm: 47.5, caseMm: 38, thicknessMm: 11.6, lugWidthMm: 22 }
    ]
  },
  {
    urlIncludes: "vacheron-constantin-overseas-345mm-and-a-few-thoughts-on-midsize-watches",
    records: [{ brand: "Vacheron Constantin", model: "Overseas 34.5", reference: "4600V", lugToLugMm: 42, caseMm: 34.5, thicknessMm: 9.3, lugWidthMm: 18, approximate: true }]
  },
  {
    urlIncludes: "hands-on-audemars-piguet-neo-frame-jumping-hour",
    records: [
      { brand: "Audemars Piguet", model: "Neo Frame Jumping Hour", lugToLugMm: 47.1, caseMm: 34, thicknessMm: 8.8 },
      { brand: "Cartier", model: "Tank à Guichets 2025", lugToLugMm: 37.6, caseMm: 24.8, thicknessMm: 6 }
    ]
  },
  {
    urlIncludes: "bringing-some-vintage-heat-with-a-double-signed-patek-philippe-calatrava",
    records: [{ brand: "Heuer", model: "Chronosplit Manhattan", lugToLugMm: 46, caseMm: 36.5, semantic: true }]
  },
  {
    urlIncludes: "from-the-first-bond-to-the-latest-bond-and-even-a-special-moonshine-speedmaster",
    records: [{ brand: "Omega", model: "Seamaster Ploprof 1200M Titanium", lugToLugMm: 48, caseMm: 55, allowUnparsed: true }]
  },
  {
    urlIncludes: "glashutte-original-collaborates-with-europes-oldest-porcelain-manufacturer-meissen",
    records: ["1-36-16-03-05-01", "1-36-16-02-05-01", "1-36-16-01-05-01"].map((reference) => ({
      brand: "Glashütte Original",
      model: "Senator Meissen Porcelain Dial",
      reference,
      lugToLugMm: 47.09,
      caseMm: 40,
      thicknessMm: 10.23,
      allowUnparsed: true
    }))
  },
  {
    urlIncludes: "hands-on-de-bethune-db28xp-db28xs",
    records: [{ brand: "De Bethune", model: "DB28XP Kind of Blue", lugToLugMm: 54.5, caseMm: 42, thicknessMm: 8.5, allowUnparsed: true, noteSuffix: "Its spring-loaded floating lugs can compress below the quoted maximum span." }]
  },
  {
    urlIncludes: "hands-on-nivada-chronosport",
    records: [{ brand: "Nivada Grenchen", model: "Chronosport", lugToLugMm: 44.3, caseMm: 38, thicknessMm: 15.7, allowUnparsed: true }]
  },
  {
    urlIncludes: "in-depth-rolex-oyster-perpetual-41",
    records: [
      { brand: "Rolex", model: "Oyster Perpetual 41", reference: "124300", lugToLugMm: 47.35, caseMm: 41, thicknessMm: 12, approximate: true, allowUnparsed: true },
      { brand: "Rolex", model: "Oyster Perpetual 39", reference: "114300", lugToLugMm: 44.06, caseMm: 39, thicknessMm: 12, approximate: true, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "introducing-anoma-watches-a1-slate",
    records: [{ brand: "Anoma", model: "A1 Slate", reference: "A1 Slate", lugToLugMm: 39, caseMm: 38, thicknessMm: 9.45, semantic: true }]
  },
  {
    urlIncludes: "introducing-merci-lmm-01-2025",
    records: ["The Dress Watch", "The Numerals", "The Militare", "The Scientific"].map((model) => ({
      brand: "Merci Instruments",
      model: `LMM-01 ${model}`,
      lugToLugMm: 47,
      caseMm: 38,
      thicknessMm: 9.55,
      allowUnparsed: true
    }))
  },
  {
    urlIncludes: "kollokium-projekt-02-variant-b-2",
    records: [{ brand: "Kollokium", model: "PROJEKT 02 VARIANT B", lugToLugMm: 46, caseMm: 39.5, thicknessMm: 12.4, approximate: true, allowUnparsed: true, noteSuffix: "The full height including the sapphire crystal is 12.4mm; 5.9mm is the mid-case height alone." }]
  },
  {
    urlIncludes: "marathon-limited-edition-adanac-stainless-steel-navigator-pilots-automatic",
    records: [{ brand: "Marathon", model: "ADANAC Stainless Steel Navigator Pilot's Automatic", reference: "WW194030SS-1601", lugToLugMm: 48, caseMm: 41, thicknessMm: 11.5, lugWidthMm: 20, allowUnparsed: true }]
  },
  {
    urlIncludes: "nomos-glashutte-tangente-neomatik-39-silvercut-hands-on",
    records: [{ brand: "NOMOS", model: "Tangente Neomatik 39 Silvercut", reference: "141", lugToLugMm: 48, caseMm: 38.5, thicknessMm: 7.2, allowUnparsed: true }]
  },
  {
    urlIncludes: "our-favorite-ridiculously-heavy-duty-dive-watches",
    records: [{ brand: "Omega", model: "Seamaster Ploprof 1200M Titanium", lugToLugMm: 48, caseMm: 55, allowUnparsed: true }]
  },
  {
    urlIncludes: "rado-over-pole-limited-review-2022",
    records: [{ brand: "Rado", model: "Captain Cook Over-Pole Limited Edition", lugToLugMm: 43, caseMm: 37, thicknessMm: 10.3, allowUnparsed: true }]
  },
  {
    urlIncludes: "reference-points-patek-philippe-split-seconds-wristwatch",
    records: [{ brand: "Patek Philippe", model: "Split-Seconds Chronograph", reference: "5950", lugToLugMm: 45, caseMm: 37, thicknessMm: 10.15, allowUnparsed: true }]
  },
  {
    urlIncludes: "our-42-story-our-favorite-seiko-collaboration-of-the-year",
    records: [{ brand: "Seiko x Rowing Blazers", model: "Seiko 5 Sports 2021 Collaboration", lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.4, allowUnparsed: true }]
  },
  {
    urlIncludes: "seikos-new-collab-with-rowing-blazers-is-a-stroke-of-genius",
    records: [{ brand: "Seiko x Rowing Blazers", model: "Seiko 5 Sports 2021 Collaboration", lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.4, allowUnparsed: true }]
  },
  {
    urlIncludes: "serica-expands-its-field-watch-offering-with-the-new-6190-msl-chronometer",
    records: [{ brand: "Serica", model: "6190 M.S.L Chronometer", reference: "6190 M.S.L. Chronometer", lugToLugMm: 46.5, caseMm: 37.7, thicknessMm: 10.4, lugWidthMm: 20, allowUnparsed: true }]
  },
  {
    urlIncludes: "spikes-car-radio-offers-a-unique-set-of-host-themed-sheffield-watches",
    records: [{ brand: "Sheffield", model: "Allsport Spike's Car Radio", lugToLugMm: 48, caseMm: 40, thicknessMm: 13, allowUnparsed: true }]
  },
  {
    urlIncludes: "tag-heuer-aquaracer-300",
    records: [
      { brand: "TAG Heuer", model: "Aquaracer Professional 300 Date", lugToLugMm: 48, caseMm: 42, thicknessMm: 12, allowUnparsed: true },
      { brand: "TAG Heuer", model: "Aquaracer Professional 300 GMT", lugToLugMm: 48, caseMm: 42, thicknessMm: 13.45, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "taking-a-closer-look-at-the-straum-jan-mayen-titanium",
    records: [{ brand: "Straum", model: "Jan Mayen Titanium", lugToLugMm: 45.8, caseMm: 39, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-40mm-panerai-radiomir-quaranta-goldtech",
    records: [{ brand: "Panerai", model: "Radiomir Quaranta Goldtech", reference: "PAM01026", lugToLugMm: 48, caseMm: 40, thicknessMm: 10.15, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-g-shock-nano-dwn5600-ring-watch",
    records: [{ brand: "G-Shock", model: "Nano Ring Watch", reference: "DWN5600", lugToLugMm: 23.4, caseMm: 20, thicknessMm: 7.5, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-patek-philippe-reference-5531r-world-time-minute-repeater-new-york-2017-special-edition",
    records: [{ brand: "Patek Philippe", model: "World Time Minute Repeater New York Special Edition", reference: "5531R", lugToLugMm: 47.35, caseMm: 42, thicknessMm: 11.49, lugWidthMm: 21, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-serica-5303-pld-limited-edition-is-designed-for-french-naval-divers",
    records: [{ brand: "Serica", model: "5303 PLD", reference: "5303 PLD", lugToLugMm: 46.5, caseMm: 39, thicknessMm: 12.2, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-surprising-origins-of-tag-heuers-formula-1-watches",
    records: [{ brand: "TAG Heuer", model: "Formula 1 Original", lugToLugMm: 40, caseMm: 35, semantic: true }]
  },
  {
    urlIncludes: "the-tag-heuer-carrera-36mm-in-hot-new-colors-and-with-a-movement-upgrade",
    records: ["WBN2310.BA0001", "WBN2311.BA0001", "WBN2312.BA0001", "WBN2313.BA0001"].map((reference) => ({
      brand: "TAG Heuer",
      model: "Carrera Date 36",
      reference,
      lugToLugMm: 41.6,
      caseMm: 36,
      thicknessMm: 10,
      allowUnparsed: true
    }))
  },
  {
    urlIncludes: "the-tudor-pelagos-fxd-ref-25707b",
    records: [{ brand: "Tudor", model: "Pelagos FXD", reference: "M25707B", lugToLugMm: 52, caseMm: 42, thicknessMm: 12.75, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-typsim-100m",
    records: [{ brand: "Typsim", model: "100M", lugToLugMm: 45, caseMm: 36, thicknessMm: 11.3, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-unimatic-modello-cinque-u5s-bl-offers-a-subtle-new-twist-of-dimensionality",
    records: [{ brand: "Unimatic", model: "Modello Cinque", reference: "U5S-BL", lugToLugMm: 43.7, caseMm: 36, thicknessMm: 11.6, lugWidthMm: 22, allowUnparsed: true }]
  },
  {
    urlIncludes: "zenith-chronomaster-open-2022",
    records: [{ brand: "Zenith", model: "Chronomaster Open", lugToLugMm: 45.2, caseMm: 39.5, thicknessMm: 13.1, allowUnparsed: true }]
  },
  {
    urlIncludes: "urwerk-continues-to-confuse-and-captivate",
    records: [{ brand: "Urwerk", model: "UR-112 Back to Black", lugToLugMm: 51, caseMm: 42, thicknessMm: 16, semantic: true }]
  },
  {
    urlIncludes: "introducing-the-cartier-tank-anglaise-a-new-tank-using-carti",
    records: [{ brand: "Cartier", model: "Tank Anglaise Large", lugToLugMm: 47, caseMm: 36.2, thicknessMm: 9.82, semantic: true }]
  },
  {
    titleIncludes: "Vacheron Constantin Malte Tourbillon Openworked",
    records: [{ brand: "Vacheron Constantin", model: "Malte Tourbillon Openworked", lugToLugMm: 48.24, caseMm: 38, thicknessMm: 12.7, semantic: true }]
  },
  {
    urlIncludes: "introducing-richard-mille-rm19-02",
    records: [{ brand: "Richard Mille", model: "RM 19-02 Tourbillon Fleur", reference: "RM 19-02", lugToLugMm: 45, caseMm: 38.3, thicknessMm: 12.5, semantic: true }]
  },
  {
    titleIncludes: "Eterna Super KonTiki Chronograph",
    records: [{ brand: "Eterna", model: "Super KonTiki Chronograph", lugToLugMm: 50, caseMm: 45, thicknessMm: 16, semantic: true }]
  },
  {
    urlIncludes: "a-rare-basculante-a-round-santos-and-more-classic-cartier",
    records: [{ brand: "Cartier", model: "Tank Solo XL", lugToLugMm: 41, caseMm: 31, thicknessMm: 7.5, semantic: true }]
  },
  {
    urlIncludes: "cartier-prive-tonneau-2019-introducing",
    records: [{ brand: "Cartier", model: "Privé Tonneau Large", lugToLugMm: 46.1, caseMm: 26.2, thicknessMm: 8.8, semantic: true }]
  },
  {
    urlIncludes: "watches-and-wonders-2025-cartier-tank-louis-automatic",
    records: [{ brand: "Cartier", model: "Tank Louis Cartier Automatic", lugToLugMm: 38.1, caseMm: 27.75, thicknessMm: 8.18, semantic: true }]
  },
  {
    titleIncludes: "HYT Hastroid Supernova",
    records: [{ brand: "HYT", model: "Hastroid Supernova", lugToLugMm: 52, caseMm: 48, thicknessMm: 17.2, semantic: true }]
  },
  {
    titleIncludes: "Raymond Weil Toccata Heritage",
    records: [{ brand: "Raymond Weil", model: "Toccata Heritage", lugToLugMm: 38, caseMm: 33, thicknessMm: 6.95, semantic: true }]
  },
  {
    urlIncludes: "the-tonal-titanium-and-totally-cool-urwerk-ur-100v-magic-t",
    records: [{ brand: "Urwerk", model: "UR-100V Magic T", lugToLugMm: 49.7, caseMm: 41, thicknessMm: 14, semantic: true }]
  },
  {
    titleIncludes: "Urwerk UR-106 Lotus",
    records: [{ brand: "Urwerk", model: "UR-106 Lotus", lugToLugMm: 49.4, caseMm: 35, thicknessMm: 14.45, semantic: true }]
  },
  {
    titleIncludes: "Urwerk UR-150 Blue Scorpion",
    records: [{ brand: "Urwerk", model: "UR-150 Blue Scorpion", lugToLugMm: 51, caseMm: 42.5, thicknessMm: 14.8, semantic: true }]
  },
  {
    urlIncludes: "a-lesson-in-proportion-and-fit-with-the-doxa-sub-600t",
    records: [{ brand: "Doxa", model: "SUB 600T", lugToLugMm: 47, caseMm: 40, thicknessMm: 14.5, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "a-rolex-made-for-the-deepest-depths",
    records: [{ brand: "Rolex", model: "Sea-Dweller Deepsea Deep Blue", reference: "126660", lugToLugMm: 53, caseMm: 44 }]
  },
  {
    urlIncludes: "baltic-wins-the-race-with-this-70s-inspired-limited-edition-chronograph",
    records: [{ brand: "Baltic x Peter Auto", model: "Tricompax", lugToLugMm: 47, caseMm: 39.5, thicknessMm: 13.5 }]
  },
  {
    urlIncludes: "best-mechanical-watches-under-1000-seiko-hamilton-tissot",
    records: [
      { brand: "Hamilton", model: "Khaki Field Mechanical 38", reference: "H69439931", lugToLugMm: 47, caseMm: 38, approximate: true },
      { brand: "Tissot", model: "Gentleman", lugToLugMm: 49, caseMm: 40, thicknessMm: 10.64, approximate: true }
    ]
  },
  {
    urlIncludes: "breitling-designer-sylvain-berneron-sets-out-to-explore-asymmetry",
    records: [{ brand: "Berneron", model: "Mirage Prototype", lugToLugMm: 42, caseMm: 33.5 }]
  },
  {
    urlIncludes: "breitling-launches-two-new-nfl-team-watches",
    records: [
      { brand: "Breitling", model: "Chronomat Automatic GMT 40 NFL Team Editions", reference: "Chronomat Automatic GMT 40 NFL Team Editions", lugToLugMm: 47.4, caseMm: 40, thicknessMm: 11.77 },
      { brand: "Breitling", model: "Endurance Pro NFL Team Editions", reference: "Endurance Pro NFL Team Editions", lugToLugMm: 52.49, caseMm: 44, thicknessMm: 12.5 }
    ]
  },
  {
    urlIncludes: "bring-a-loupe-june-21-2025",
    records: [{ brand: "Patek Philippe", model: "Perpetual Calendar", reference: "5040J", lugToLugMm: 42.5, caseMm: 36 }]
  },
  {
    urlIncludes: "bring-a-loupe-june-27-2025",
    records: [{ brand: "Habring² x Monochrome", model: "Montre de Souscription 1", lugToLugMm: 46, caseMm: 38.5, thicknessMm: 12 }]
  },
  {
    urlIncludes: "bring-a-loupe-march-13",
    records: [{ brand: "Corum", model: "Golden Bridge", reference: "05.0002", lugToLugMm: 50, caseMm: 32 }]
  },
  {
    urlIncludes: "bring-a-loupe-march-14-2025",
    records: [{ brand: "Harvard by Gallet", model: "Regulator Monopusher Chronograph", lugToLugMm: 38, caseMm: 34 }]
  },
  {
    urlIncludes: "bring-a-loupe-march-27-2026",
    records: [{ brand: "Omega", model: "Calendar Grand Luxe", reference: "3953", lugToLugMm: 40, caseMm: 32 }]
  },
  {
    urlIncludes: "bring-a-loupe-march-28-2025",
    records: [{ brand: "Titus", model: "Calypsomatic Mid-Size", reference: "7987", lugToLugMm: 41, caseMm: 32 }]
  },
  {
    urlIncludes: "bulova-wilton-gmt-miyota-9075",
    records: ["96B385", "97B210"].map((reference) => ({ brand: "Bulova", model: "Classic Wilton GMT", reference, lugToLugMm: 49.5, caseMm: 43, thicknessMm: 12.7, lugWidthMm: 22, approximate: true }))
  },
  {
    urlIncludes: "dive-dive-dive-with-the-omega-seamaster-planet-ocean-ultra-deep",
    records: [
      { brand: "Omega", model: "Seamaster Planet Ocean Ultra Deep Titanium", lugToLugMm: 56, caseMm: 45.5, thicknessMm: 18.12 },
      { brand: "Omega", model: "Seamaster Planet Ocean Ultra Deep O-Megasteel", lugToLugMm: 51.95, caseMm: 45.5, thicknessMm: 18.12, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "editors-picks-watch-wed-wear-to-our-best-friends-wedding",
    records: [{ brand: "NOMOS", model: "Orion Neomatik New Black 36", lugToLugMm: 45, caseMm: 36.4, thicknessMm: 8.5 }]
  },
  {
    urlIncludes: "favorite-2020-new-releases-for-under-3000",
    records: [{ brand: "Seiko", model: "Prospex 1965 Heritage Diver", reference: "SPB143", lugToLugMm: 46.5, caseMm: 40.5, thicknessMm: 13.7 }]
  },
  {
    urlIncludes: "five-fun-and-functional-new-releases-from-sinn",
    records: [{ brand: "Sinn", model: "556 Limited Edition Colors", lugToLugMm: 45.5, caseMm: 38.5, thicknessMm: 11 }]
  },
  {
    urlIncludes: "five-of-my-favorite-new-watches-from-small-brands-right-now",
    records: [
      { brand: "Lorier", model: "Olympia Chronograph", lugToLugMm: 46, caseMm: 39, thicknessMm: 13.8 },
      { brand: "Marin Instruments", model: "Skin-Diver OS Polar", lugToLugMm: 48, caseMm: 39, thicknessMm: 11.5 }
    ]
  },
  {
    urlIncludes: "five-of-the-wildest-watches-from-geneva-watch-days-2025",
    records: [
      { brand: "Czapek", model: "Antarctique Rattrapante R.U.R.", lugToLugMm: 46.6, caseMm: 42.5, thicknessMm: 15.3 },
      { brand: "Bianchet", model: "Ultrafino Sapphire", lugToLugMm: 47.5, caseMm: 40, thicknessMm: 9.8 }
    ]
  },
  {
    urlIncludes: "gift-guide-10-valentines-gifts-that-will-be-remembered",
    records: [{ brand: "Oris", model: "Aquis Date Cherry Red", lugToLugMm: 48, caseMm: 41.5 }]
  },
  {
    urlIncludes: "hands-on-biver-automatique",
    records: [{ brand: "Biver", model: "Automatique", lugToLugMm: 47.5, caseMm: 39, thicknessMm: 10 }]
  },
  {
    urlIncludes: "hands-on-momentum-udt-eclipse-synch-solar",
    records: [{ brand: "Momentum", model: "UDT Eclipse Synch Solar", reference: "UDT Eclipse Synch Solar", lugToLugMm: 48.2, caseMm: 43, thicknessMm: 11.7, approximate: true, noteSuffix: "Hodinkee also notes the manufacturer's 42mm width and 47mm span measured between the lug holes." }]
  },
  {
    urlIncludes: "hands-on-patek-philippe-5316p",
    records: [{ brand: "Patek Philippe", model: "Automatic Perpetual Calendar Minute Repeater", reference: "5013", lugToLugMm: 46.5, caseMm: 37, thicknessMm: 12 }]
  },
  {
    urlIncludes: "hands-on-rolex-daytona-meteorite-2025",
    records: [{ brand: "Rolex", model: "Cosmograph Daytona Meteorite", reference: "126519LN", lugToLugMm: 47.5, caseMm: 40, thicknessMm: 11.4 }]
  },
  {
    urlIncludes: "hands-on-trilobe-trente-deux",
    records: [{ brand: "Trilobe", model: "Trente-Deux", lugToLugMm: 46.18, caseMm: 39.5, thicknessMm: 10.15 }]
  },
  {
    urlIncludes: "haven-watch-co-has-two-new-watches",
    records: [
      { brand: "Haven Watch Co.", model: "Lomax", reference: "1332", lugToLugMm: 45.5, caseMm: 39, thicknessMm: 12.7, lugWidthMm: 20 },
      { brand: "Haven Watch Co.", model: "Trotter", reference: "3606", lugToLugMm: 45, caseMm: 39, thicknessMm: 12.7, lugWidthMm: 20 }
    ]
  },
  {
    urlIncludes: "how-a-pulsation-scale-actually-works",
    records: [{ brand: "Farer", model: "Cobb Monopusher Chronograph", lugToLugMm: 44, caseMm: 40.5, thicknessMm: 12 }]
  },
  {
    urlIncludes: "intro-lorca-model-no-2-chronograph",
    records: [{ brand: "Lorca", model: "Model No. 2 Chronograph", reference: "8501", lugToLugMm: 46, caseMm: 37, thicknessMm: 14.1, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "intro-patek-philippe-50th-nautilus",
    records: [
      { brand: "Patek Philippe", model: "Nautilus 50th Anniversary Jumbo", reference: "5810/1G-001", lugToLugMm: 45.5, caseMm: 41, thicknessMm: 6.9 },
      { brand: "Patek Philippe", model: "Nautilus 50th Anniversary Jumbo", reference: "5810G-001", lugToLugMm: 45.5, caseMm: 41, thicknessMm: 6.9 },
      { brand: "Patek Philippe", model: "Nautilus 50th Anniversary Mid-Size", reference: "5610/1P-001", lugToLugMm: 42.44, caseMm: 38, thicknessMm: 6.9 }
    ]
  },
  {
    urlIncludes: "introducing-richard-mille-rm-55-01",
    records: [{ brand: "Richard Mille", model: "RM 55-01", reference: "RM 55-01", lugToLugMm: 47.33, caseMm: 37.95, thicknessMm: 10.75 }]
  },
  {
    urlIncludes: "longines-avigation-bigeye-value-proposition-hands-on",
    records: [{ brand: "Longines", model: "Avigation BigEye", reference: "L2.816.4.53.2", lugToLugMm: 50, caseMm: 41, thicknessMm: 14.45 }]
  },
  {
    urlIncludes: "ming-3707-fifth-anniversary-mosaic",
    records: [{ brand: "Ming", model: "37.07 Mosaic", reference: "37.07 Mosaic", lugToLugMm: 44.5, caseMm: 38, thicknessMm: 10.9, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "monta-goes-green-to-say-farewell-to-the-triumph",
    records: [{ brand: "Monta", model: "Triumph 2017 Generation", lugToLugMm: 47, caseMm: 38.5, thicknessMm: 9.7 }]
  },
  {
    urlIncludes: "my-first-vintage-dive-watch",
    records: [{ brand: "Silvana", model: "Vintage Skin Diver", lugToLugMm: 47, caseMm: 37, thicknessMm: 13, lugWidthMm: 20, approximate: true }]
  },
  {
    urlIncludes: "nomos-tangente-junghans-max-bill-bauhaus",
    records: [
      { brand: "Junghans", model: "Max Bill Automatic", reference: "027/3500.04", lugToLugMm: 40, caseMm: 38, thicknessMm: 10, lugWidthMm: 20 },
      { brand: "NOMOS", model: "Tangente Neomatik 39", reference: "140", lugToLugMm: 48, caseMm: 38.5, thicknessMm: 7.2, lugWidthMm: 19 }
    ]
  },
  {
    urlIncludes: "pre-owned-picks-august-9",
    records: [{ brand: "Patek Philippe", model: "Gondolo", reference: "5024", lugToLugMm: 38, caseMm: 30, thicknessMm: 6.5 }]
  },
  {
    urlIncludes: "pre-owned-wrists-come-in-all-sizes",
    records: [{ brand: "Omega", model: "Seamaster Aqua Terra 150M XXL Small Seconds", reference: "231.53.49.10.04.001", lugToLugMm: 56, caseMm: 49.2, approximate: true }]
  },
  {
    urlIncludes: "seiko-5-sports-srpd-review",
    records: [
      ...["SRPD55", "SRPD51", "SRPD53", "SRPD57", "SRPD59", "SRPD63", "SRPD65K2", "SRPD71K2", "SRPD73K2", "SRPD76", "SRPD79"].map((reference) => ({ brand: "Seiko", model: "5 Sports SRPD", reference, lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.4, lugWidthMm: 22 })),
      { brand: "Seiko", model: "SKX007", reference: "SKX007", lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.25 },
      { brand: "Seiko", model: "Prospex Turtle", reference: "SRP777", lugToLugMm: 48, caseMm: 44.3 }
    ]
  },
  {
    urlIncludes: "seiko-prospex-spb143-a-week-on-the-wrist-review",
    records: [
      { brand: "Seiko", model: "Prospex 1965 Heritage Diver", reference: "SPB143", lugToLugMm: 46.5, caseMm: 40.5, thicknessMm: 13.7 },
      { brand: "Sinn", model: "104 St Sa", lugToLugMm: 46.5, caseMm: 41, thicknessMm: 11.5 },
      { brand: "Seiko", model: "Prospex Captain Willard", reference: "SPB151", lugToLugMm: 46, caseMm: 42.7, thicknessMm: 15, approximate: true },
      { brand: "Seiko", model: "Prospex Captain Willard", reference: "SPB153", lugToLugMm: 46, caseMm: 42.7, thicknessMm: 15, approximate: true }
    ]
  },
  {
    urlIncludes: "seikos-new-sbp313-is-a-fresh-take",
    records: [{ brand: "Seiko", model: "Prospex Slim Turtle", reference: "SPB313", lugToLugMm: 46.9, caseMm: 41, thicknessMm: 12.3 }]
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/seven-lesser-known-patek-calatrava-references",
    records: [{ brand: "Patek Philippe", model: "Calatrava", reference: "5022", lugToLugMm: 38, caseMm: 33, lugWidthMm: 18 }]
  },
  {
    urlIncludes: "the-18-story-of-23-seven-lesser-known-patek-calatrava-references",
    records: [{ brand: "Patek Philippe", model: "Calatrava", reference: "5022", lugToLugMm: 38, caseMm: 33, lugWidthMm: 18 }]
  },
  {
    urlIncludes: "the-19-story-of-2023-a-week-on-the-wrist-with-the-tag-heuer-carrera-glassbox",
    records: [{ brand: "TAG Heuer", model: "Carrera Glassbox 39", lugToLugMm: 46, caseMm: 39, thicknessMm: 14 }]
  },
  {
    urlIncludes: "the-tag-heuer-carrera-glassbox-39mm-its-time-to-care-about-the-carrera-again",
    records: [{ brand: "TAG Heuer", model: "Carrera Glassbox 39", lugToLugMm: 46, caseMm: 39, thicknessMm: 14 }]
  },
  {
    urlIncludes: "the-3-story-of-24-debating-the-best-titanium-watches",
    records: [{ brand: "Grand Seiko", model: "Snowflake Spring Drive", reference: "SBGA211", lugToLugMm: 49, caseMm: 41, thicknessMm: 12.5 }]
  },
  {
    urlIncludes: "three-on-three-tudor-zenith-grand-seiko-titanium-watches",
    records: [{ brand: "Grand Seiko", model: "Snowflake Spring Drive", reference: "SBGA211", lugToLugMm: 49, caseMm: 41, thicknessMm: 12.5 }]
  },
  {
    urlIncludes: "the-aquanaut-travel-time-ref-5650g",
    records: [{ brand: "Patek Philippe", model: "Aquanaut Travel Time Advanced Research", reference: "5650G-001", lugToLugMm: 47.6, caseMm: 40.8, caseReported: false, thicknessMm: 11, lugWidthMm: 21, noteSuffix: "Hodinkee quotes 45.24mm from 9 to 3 o'clock including the crown; 40.8mm is stored as the conventional crown-excluding case width." }]
  },
  {
    urlIncludes: "the-biggest-watch-surprises-of-2020-so-far",
    records: [
      { brand: "Breitling", model: "Superocean Heritage '57 Capsule Collection", lugToLugMm: 46, caseMm: 42, thicknessMm: 9.99 },
      { brand: "Seiko", model: "Prospex 1965 Heritage Diver", reference: "SPB143", lugToLugMm: 47.6, caseMm: 40.5, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "the-budget-watch-of-the-year-is-a-seiko-thats-going-places",
    records: [
      ...["SSK001", "SSK003", "SSK005"].map((reference) => ({ brand: "Seiko", model: "5 Sports SSK GMT", reference, lugToLugMm: 45.7, caseMm: 42.5, thicknessMm: 13.8 })),
      { brand: "Citizen", model: "Aqualand", reference: "JP2007-17W", lugToLugMm: 47.7, caseMm: 44, thicknessMm: 14.4, noteSuffix: "Hodinkee also reports 50.8mm across when the pressure-sensor projection is included." }
    ]
  },
  {
    urlIncludes: "the-doxa-sub-200t-a-smaller-take",
    records: [{ brand: "Doxa", model: "SUB 200T", lugToLugMm: 41.5, caseMm: 39, thicknessMm: 10.7, lugWidthMm: 18 }]
  },
  {
    urlIncludes: "the-farer-world-timer-automatic-roche",
    records: [{ brand: "Farer", model: "World Timer Automatic Roché", lugToLugMm: 45, caseMm: 39, thicknessMm: 11 }]
  },
  {
    urlIncludes: "the-funk-and-fun-of-the-brew-metric",
    records: [{ brand: "Brew", model: "Metric Retro Dial", lugToLugMm: 41.5, caseMm: 36, thicknessMm: 10.75 }]
  },
  {
    urlIncludes: "the-iwc-pilots-watch-chronograph-spitfire",
    records: [
      { brand: "IWC", model: "Pilot's Watch Chronograph Spitfire", reference: "IW387901", lugToLugMm: 51.5, caseMm: 41, thicknessMm: 15.3, lugWidthMm: 20 },
      { brand: "Longines", model: "Avigation BigEye", reference: "L2.816.4.53.2", lugToLugMm: 50, caseMm: 41, thicknessMm: 14.45 }
    ]
  },
  {
    urlIncludes: "the-most-affordable-vintage-rolex-is-worth-your-time",
    records: [{ brand: "Rolex", model: "Oyster Precision", reference: "6426", lugToLugMm: 42, caseMm: 34, caseReported: false, lugWidthMm: 19, noteSuffix: "The 34mm case-width field identifies the reference; the article directly supplies the 42mm span and 19mm lug width." }]
  },
  {
    urlIncludes: "the-new-tag-heuer-carrera-chronograph-seafarer",
    records: [{ brand: "TAG Heuer", model: "Carrera Chronograph Seafarer", lugToLugMm: 48.6, caseMm: 42, thicknessMm: 14.4 }]
  },
  {
    urlIncludes: "the-newest-retro-cool-seiko-5",
    records: [
      { brand: "Seiko", model: "5 Sports 55th Anniversary", reference: "SRPK17", lugToLugMm: 43, caseMm: 39, thicknessMm: 12.5 },
      ...["SRPK09", "SRPK11", "SRPK13"].map((reference) => ({ brand: "Seiko", model: "5 Sports 1968 Recreation", reference, lugToLugMm: 47, caseMm: 42.5, thicknessMm: 13.4 }))
    ]
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/the-nivada-grenchen-antarctic-gmt",
    records: [{ brand: "Nivada Grenchen", model: "Antarctic GMT", lugToLugMm: 40, caseMm: 36, thicknessMm: 11.6 }]
  },
  {
    urlIncludes: "the-rolex-perpetual-1908-might-just-be-the-dressy-rolex",
    records: [{ brand: "Tudor", model: "Black Bay Fifty-Eight", reference: "M79030N-0001", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.9 }]
  },
  {
    urlIncludes: "the-vertex-aqualion-m60c",
    records: [{ brand: "Vertex", model: "AquaLion M60C", lugToLugMm: 49, caseMm: 40, thicknessMm: 13.25 }]
  },
  {
    urlIncludes: "then-and-now-revisiting-my-first-watch",
    records: [
      { brand: "Timex", model: "Ironman Early-1990s", lugToLugMm: 46, caseMm: 37, thicknessMm: 11, approximate: true },
      { brand: "Timex", model: "Ironman Full-Size", lugToLugMm: 48, caseMm: 41.5, thicknessMm: 15, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "three-on-three-grand-seiko-omega-rolex-automatics",
    records: [{ brand: "Omega", model: "Seamaster Aqua Terra 150M 38 (2017)", lugToLugMm: 44, caseMm: 38, thicknessMm: 12 }]
  },
  {
    urlIncludes: "tudor-black-bay-chrono-hits-its-stride-hands-on",
    records: [{ brand: "Tudor", model: "Black Bay Chrono", reference: "Black Bay Chrono", lugToLugMm: 49.9, caseMm: 41, thicknessMm: 14.2, approximate: true }]
  },
  {
    urlIncludes: "turning-back-the-clock-to-the-re-launch-of-the-seiko-5-video",
    records: [
      ...["SRPD55", "SRPD51", "SRPD53", "SRPD57", "SRPD59", "SRPD63", "SRPD65K2", "SRPD71K2", "SRPD73K2", "SRPD76", "SRPD79"].map((reference) => ({ brand: "Seiko", model: "5 Sports SRPD", reference, lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.4, lugWidthMm: 22 })),
      { brand: "Seiko", model: "SKX007", reference: "SKX007", lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.25 },
      { brand: "Seiko", model: "Prospex Turtle", reference: "SRP777", lugToLugMm: 48, caseMm: 44.3 }
    ]
  },
  {
    urlIncludes: "unimatic-u1-divers-summer-2018",
    records: ["U1-E", "U1-EN", "U1-EM", "U1-EMN"].map((reference) => ({ brand: "Unimatic", model: "U1 Diver", reference, lugToLugMm: 49, caseMm: 40, thicknessMm: 14, lugWidthMm: 22 }))
  },
  {
    urlIncludes: "vintage-watches-may-4-2022",
    records: [{ brand: "Omega", model: "Seamaster Chronograph", reference: "145.005-67", lugToLugMm: 41, caseMm: 35, thicknessMm: 12.5 }]
  },
  {
    urlIncludes: "vintage-watches-seven-gamechanging-watches",
    records: [{ brand: "James Schulz", model: "Perpetual Calendar Minute-Repeating Chronograph", reference: "13,511", lugToLugMm: 40, caseMm: 29 }]
  },
  {
    urlIncludes: "watches-that-decreased-in-case-size",
    records: [{ brand: "Tudor", model: "Black Bay Chrono", reference: "Black Bay Chrono", lugToLugMm: 49.8, caseMm: 41, thicknessMm: 14.4 }]
  },
  {
    urlIncludes: "with-the-subtle-refined-and-entirely-capable-sinn-t50",
    records: [{ brand: "Sinn", model: "T50", lugToLugMm: 47, caseMm: 41, thicknessMm: 12.3, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "woah-hamilton-just-released-the-murph-watch-in-38mm",
    records: ["H70405730", "H70405130", "H70405710"].map((reference) => ({ brand: "Hamilton", model: "Khaki Field Murph 38mm", reference, lugToLugMm: 44.7, caseMm: 38, thicknessMm: 11.1, lugWidthMm: 20, allowUnparsed: true }))
  },
  {
    urlIncludes: "a-pair-of-bi-color-omega-speedmaster-moonwatches",
    records: ["310.20.42.50.02.001", "310.20.42.50.99.001"].map((reference) => ({ brand: "Omega", model: "Speedmaster Moonwatch Professional Bi-Color", reference, lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.2 }))
  },
  {
    urlIncludes: "breitling-top-time-b01-martini-racing",
    records: [{ brand: "Breitling", model: "Top Time B01 Martini Racing", lugToLugMm: 44.1, caseMm: 38, thicknessMm: 13.3, lugWidthMm: 18 }]
  },
  {
    urlIncludes: "bremont-evolves-the-mb-with-the-new-altitude-collection",
    records: [{ brand: "Bremont", model: "Altitude Chronograph GMT", lugToLugMm: 49.62, caseMm: 42, lugWidthMm: 22 }]
  },
  {
    urlIncludes: "bring-a-loupe-october-7-2016",
    records: [{ brand: "Doxa", model: "T.Graph SUB 200 Professional", lugToLugMm: 46, caseMm: 43, caseReported: false, thicknessMm: 14, approximate: true, noteSuffix: "The article directly reports the 46mm span and 14mm thickness; 43mm is retained as the nominal family width required by the seed schema." }]
  },
  {
    urlIncludes: "british-invasion-bremont-teams-up-with-bamford",
    records: [{ brand: "Bremont x Bamford", model: "Supermarine S500 Special Edition", lugToLugMm: 51, caseMm: 43, thicknessMm: 16 }]
  },
  {
    urlIncludes: "cs-nivada-grenchen-hodinkee",
    records: [{ brand: "Nivada Grenchen", model: "Antarctic GMT Hodinkee Limited Edition", reference: "87013 Hodinkee", lugToLugMm: 40, caseMm: 36, thicknessMm: 11.1 }]
  },
  {
    urlIncludes: "giving-some-long-overdue-love-to-the-cartier-ballon-bleu",
    records: [{ brand: "Cartier", model: "Ballon Bleu 42 Rose Gold", lugToLugMm: 44, caseMm: 42, thicknessMm: 13 }]
  },
  {
    urlIncludes: "hands-on-baltic-heures-du-monde",
    records: [{ brand: "Baltic", model: "Heures du Monde Worldtimer", lugToLugMm: 45, caseMm: 37, thicknessMm: 11.3 }]
  },
  {
    urlIncludes: "hands-on-hamilton-khaki-murph-38mm-gets-a-white-dial",
    records: ["H70405130", "H70405710"].map((reference) => ({ brand: "Hamilton", model: "Khaki Field Murph 38mm", reference, lugToLugMm: 44.7, caseMm: 38, thicknessMm: 11.1, lugWidthMm: 20 }))
  },
  {
    urlIncludes: "hands-on-ming-dial-duo",
    records: [{ brand: "Ming x J.N. Shapiro", model: "37.06 Lightning", reference: "37.06 Lightning", lugToLugMm: 44.5, caseMm: 38, thicknessMm: 10.9 }]
  },
  {
    urlIncludes: "hands-on-omega-speedmaster-first-omega-in-space",
    records: [{ brand: "Omega", model: "Speedmaster First Omega in Space", reference: "310.30.40.50.06.001", lugToLugMm: 48, caseMm: 39.7, thicknessMm: 13.4, lugWidthMm: 19 }]
  },
  {
    urlIncludes: "hands-on-oris-divers-sixty-five-lfp",
    records: [{ brand: "Oris", model: "Divers Sixty-Five LFP Limited Edition", reference: "01 733 7771 4085-Set", lugToLugMm: 46, caseMm: 38, thicknessMm: 12.8 }]
  },
  {
    urlIncludes: "inspired-by-the-most-beautiful-race-in-the-world",
    records: [{ brand: "Chopard", model: "Mille Miglia Classic Chronograph 2023", lugToLugMm: 49, caseMm: 40.5, thicknessMm: 12.88, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "intro-blancpain-x-swatch-scuba-fifty-the-ocean-of-storms",
    records: [{ brand: "Blancpain x Swatch", model: "Scuba Fifty Fathoms Ocean of Storms", lugToLugMm: 48, caseMm: 42.3, thicknessMm: 14.4 }]
  },
  {
    urlIncludes: "is-the-tudor-pelagos-fxd-the-best-watch-of-2021",
    records: [{ brand: "Tudor", model: "Pelagos FXD", reference: "M25707B", lugToLugMm: 52, caseMm: 42, thicknessMm: 12.75 }]
  },
  {
    urlIncludes: "nerding-out-on-12-hour-bezels-and-matte-dials",
    records: [{ brand: "Oris", model: "Divers Sixty-Five 12H Calibre 400", lugToLugMm: 48, caseMm: 40, thicknessMm: 12.8 }]
  },
  {
    urlIncludes: "new-tag-heuer-skipper-2023",
    records: [{ brand: "TAG Heuer", model: "Carrera Skipper", lugToLugMm: 46, caseMm: 39, thicknessMm: 13.9 }]
  },
  {
    urlIncludes: "nivada-grenchen-crowdsourced-this-watch-on-instagram",
    records: [{ brand: "Nivada Grenchen", model: "Super Antarctic", reference: "91412", lugToLugMm: 45, caseMm: 38, thicknessMm: 11.5 }]
  },
  {
    urlIncludes: "norqain-freedom-60-gmt-hands-on",
    records: [{ brand: "Norqain", model: "Freedom 60 GMT", lugToLugMm: 49.2, caseMm: 40, thicknessMm: 14.5 }]
  },
  {
    urlIncludes: "old-school-subtlety-with-the-omega-ck-859",
    records: [{ brand: "Omega", model: "Specialities CK 859", reference: "511.12.39.21.99.002", lugToLugMm: 46.2, caseMm: 39, thicknessMm: 11.7, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "rado-hyperchrome-captain-cook-limited-edition-hands-on",
    records: [{ brand: "Rado", model: "HyperChrome Captain Cook Limited Edition", lugToLugMm: 43, caseMm: 37.3, approximate: true }]
  },
  {
    urlIncludes: "seikos-new-gmt-takes-on-a-travel-ready-chronometer",
    records: ["SSK001", "SSK003", "SSK005"].map((reference) => ({ brand: "Seiko", model: "5 Sports SSK GMT", reference, lugToLugMm: 46, caseMm: 42.5, thicknessMm: 13.6, lugWidthMm: 22 }))
  },
  {
    urlIncludes: "serica-goes-off-the-deep-end-with-the-5303",
    records: [{ brand: "Serica", model: "5303", reference: "5303", lugToLugMm: 46.5, caseMm: 39, thicknessMm: 12.2, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "tag-heuer-carrera-chronograph-new-hands-on",
    records: ["CBN2010", "CBN2011", "CBN2012", "CBN2013"].map((reference) => ({ brand: "TAG Heuer", model: "Carrera Chronograph 42", reference, lugToLugMm: 48.2, caseMm: 42, thicknessMm: 14.4 }))
  },
  {
    urlIncludes: "the-1709-ming-x-massena-lab",
    records: [{ brand: "Ming x Massena LAB", model: "17.09", reference: "17.09", lugToLugMm: 44, caseMm: 38, thicknessMm: 10 }]
  },
  {
    urlIncludes: "the-6-story-of-24-a-week-on-the-wrist-with-the-omega-speedmaster",
    records: [{ brand: "Omega", model: "Speedmaster Moonwatch Professional White Lacquer", reference: "310.30.42.50.04.001", lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.18 }]
  },
  {
    urlIncludes: "the-aquascaphe-titanium-is-baltics-most-modern-watch-yet",
    records: [{ brand: "Baltic", model: "Aquascaphe Titanium", lugToLugMm: 47, caseMm: 41, thicknessMm: 13.6 }]
  },
  {
    urlIncludes: "the-audemars-piguet-royal-oak-offshore-limited-edition-in-pink-gold-and-titanium",
    records: [{ brand: "Audemars Piguet", model: "Royal Oak Offshore Diver Pink Gold and Titanium Limited Edition", lugToLugMm: 54, caseMm: 42 }]
  },
  {
    urlIncludes: "the-black-dial-tag-heuer-carrera-39mm-glassbox",
    records: [{ brand: "TAG Heuer", model: "Carrera Glassbox 39 Black Dial", lugToLugMm: 46, caseMm: 39, thicknessMm: 14 }]
  },
  {
    urlIncludes: "the-breitling-superocean-automatic-42",
    records: [{ brand: "Breitling", model: "SuperOcean Automatic 42", reference: "A17366", lugToLugMm: 50.5, caseMm: 42, thicknessMm: 13.5, approximate: true }]
  },
  {
    urlIncludes: "the-farer-aquamatic-thurso-is-a-dive-watch",
    records: [{ brand: "Farer", model: "AquaMatic Thurso", lugToLugMm: 45, caseMm: 38.5, thicknessMm: 11.9, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-formex-stratos-utc-a-practical-new-take",
    records: [{ brand: "Formex", model: "Stratos UTC", lugToLugMm: 47, caseMm: 41, thicknessMm: 11.8, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-grand-seiko-spring-drive-us-only-limited-editions",
    records: [{ brand: "Grand Seiko", model: "44GS Spring Drive U.S. Limited Editions", lugToLugMm: 46.2, caseMm: 40, thicknessMm: 12.5 }]
  },
  {
    urlIncludes: "the-latest-addition-to-the-tag-heuer-glassbox",
    records: [{ brand: "TAG Heuer", model: "Carrera Chronograph Glassbox Panda", reference: "CBS2216.BA0041", lugToLugMm: 46, caseMm: 39, thicknessMm: 13.86 }]
  },
  {
    urlIncludes: "the-new-iwc-mark-xx-yes-its-better",
    records: [{ brand: "IWC", model: "Pilot's Watch Mark XX", lugToLugMm: 49, caseMm: 40, thicknessMm: 10.8 }]
  },
  {
    urlIncludes: "the-omega-speedmaster-chronoscope-is-a-true-triple-threat",
    records: [{ brand: "Omega", model: "Speedmaster Chronoscope", lugToLugMm: 48, caseMm: 43, thicknessMm: 12.8 }]
  },
  {
    urlIncludes: "the-omega-speedmaster-racing-master-chronometer",
    records: [{ brand: "Omega", model: "Speedmaster Racing Master Chronometer", lugToLugMm: 49.8, caseMm: 44.25 }]
  },
  {
    urlIncludes: "the-patek-philippe-calatrava-ref-6119",
    records: ["6119R-001", "6119G-001"].map((reference) => ({ brand: "Patek Philippe", model: "Calatrava Clous de Paris", reference, lugToLugMm: 46.9, caseMm: 39, thicknessMm: 8.08, lugWidthMm: 21 }))
  },
  {
    urlIncludes: "the-resplendent-omega-speedmaster-moonwatch-professional-in-moonshine-gold",
    records: [{ brand: "Omega", model: "Speedmaster Moonwatch Professional Moonshine Gold", lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.18, lugWidthMm: 20 }]
  },
  {
    urlIncludes: "the-urwerk-ur-100v-magic-t-in-hunter-green",
    records: [{ brand: "Urwerk", model: "UR-100V Magic T Hunter Green", lugToLugMm: 49.7, caseMm: 41, thicknessMm: 14 }]
  },
  {
    urlIncludes: "the-vulcain-nautique-skindiver-delivers",
    records: [{ brand: "Vulcain", model: "Nautique Skindiver", lugToLugMm: 44.5, caseMm: 38, thicknessMm: 12.2 }]
  },
  {
    urlIncludes: "the-zenith-chronomaster-original-adds-an-evil-el-primero",
    records: ["03.3200.3600/22.M3200", "03.3200.3600/22.C908"].map((reference) => ({ brand: "Zenith", model: "Chronomaster Original Black Tricolor", reference, lugToLugMm: 47, caseMm: 38, thicknessMm: 13 }))
  },
  {
    urlIncludes: "the-zenith-ref-a3817",
    records: [{ brand: "Zenith", model: "El Primero A3817", reference: "A3817", lugToLugMm: 47, caseMm: 37 }]
  },
  {
    urlIncludes: "three-precious-metal-omega-seamaster-300",
    records: [{ brand: "Omega", model: "Seamaster 300 Precious Metal", lugToLugMm: 48, caseMm: 41, thicknessMm: 15 }]
  },
  {
    urlIncludes: "unimatic-shrinks-down-with-the-modello-cinque-u5",
    records: ["U5S-A", "U5S-AN"].map((reference) => ({ brand: "Unimatic", model: "Modello Cinque", reference, lugToLugMm: 44, caseMm: 36, thicknessMm: 11, lugWidthMm: 22, approximate: true }))
  },
  {
    urlIncludes: "wait-undone-and-nivada-grenchen-made-the-pac-man-depthmaster",
    records: [{ brand: "Nivada Grenchen x Undone", model: "Depthmaster Pixel Art", lugToLugMm: 47, caseMm: 39 }]
  },
  {
    urlIncludes: "week-on-the-wrist-tudor-black-bay-54",
    records: [{ brand: "Tudor", model: "Black Bay Fifty-Four", lugToLugMm: 46, caseMm: 37, thicknessMm: 11.24 }]
  },
  {
    urlIncludes: "what-is-mecaquartz-and-why-is-this-36mm-nivada-grenchen-datomaster",
    records: [{ brand: "Nivada Grenchen", model: "Datomaster Mecaquartz", lugToLugMm: 45, caseMm: 36, thicknessMm: 12 }]
  },
  {
    urlIncludes: "wotw-white-omega-speedmaster",
    records: [{ brand: "Omega", model: "Speedmaster Moonwatch Professional White Lacquer", reference: "310.30.42.50.04.001", lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.18 }]
  },
  {
    urlIncludes: "intro-live-pics-jlc-hybris-artistica-caliber-179",
    records: [{ brand: "Jaeger-LeCoultre", model: "Reverso Hybris Artistica Calibre 179", lugToLugMm: 51.2, caseMm: 31, thicknessMm: 13.63, semantic: true }]
  },
  {
    urlIncludes: "seiko-prospex-1965-heritage-diver",
    records: ["SPB453", "SPB451", "SPB455"].map((reference) => ({ brand: "Seiko", model: "Prospex 1965 Heritage Diver", reference, lugToLugMm: 46.4, caseMm: 40, thicknessMm: 13, allowUnparsed: true, noteSuffix: "Hodinkee derives the 46.4mm span from a stated 1.2mm reduction versus the 47.6mm predecessor." }))
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/the-doxa-sub-200t",
    records: [{ brand: "Doxa", model: "SUB 200T", lugToLugMm: 41.5, caseMm: 39, thicknessMm: 10.7, lugWidthMm: 18, allowUnparsed: true }]
  },
  {
    urlIncludes: "the-hamilton-pulsar-psr-introducing",
    records: [{ brand: "Hamilton", model: "PSR", lugToLugMm: 40.8, caseMm: 34.7, semantic: true, noteSuffix: "The article gives the cushion case as 40.8 by 34.7mm and describes its notably short longitudinal span." }]
  },
  {
    urlIncludes: "the-omega-seamaster-planet-ocean-for-2025",
    records: [{ brand: "Omega", model: "Seamaster Planet Ocean 600M 2025", reference: "217.30.42.21.01.001", lugToLugMm: 47.5, caseMm: 42, thicknessMm: 13.8, lugWidthMm: 21, allowUnparsed: true }]
  },
  {
    urlIncludes: "timex-japan-releases-a-trio-of-metal-og-ironman-8-laps",
    records: [{ brand: "Timex", model: "Ironman 8-Lap Plastic Case", lugToLugMm: 46.3, caseMm: 39, thicknessMm: 10.5, approximate: true, allowUnparsed: true, noteSuffix: "The article uses the plastic-case models only as a comparison and says the metal editions had not yet been measured." }]
  },
  {
    urlIncludes: "what-will-rolex-release-at-watches-and-wonders",
    records: [
      { brand: "Rolex", model: "Oyster Perpetual 41", reference: "124300", lugToLugMm: 47, caseMm: 41, approximate: true, allowUnparsed: true },
      { brand: "Rolex", model: "Oyster Perpetual 39", reference: "114300", lugToLugMm: 47, caseMm: 39, approximate: true, allowUnparsed: true }
    ]
  },
  {
    urlIncludes: "yes-you-can-still-buy-a-casio-calculator-watch",
    records: [{ brand: "Casio", model: "Databank Calculator", reference: "CA53W-1", lugToLugMm: 42, caseMm: 34, thicknessMm: 8, semantic: true }]
  },
  {
    urlIncludes: "zodiac-super-sea-wolf-68-limited-edition-introducing",
    records: [{ brand: "Zodiac", model: "Super Sea Wolf 68 Limited Edition", lugToLugMm: 50, caseMm: 44, thicknessMm: 16, semantic: true }]
  }
];

// These direct-value articles have no usable structured fact block. Each
// association was reviewed against the article body and is intentionally
// explicit so comparison watches and same-sized family members do not inherit
// an unrelated Hodinkee source.
const reviewedDirectDefinitions = [
  {
    urlIncludes: "awotw-seiko-prospex-spb381",
    records: [{ brand: "Seiko", model: "Prospex 1968 Heritage Diver's GMT Watch", reference: "SPB381", lugToLugMm: 48.1, caseMm: 42, caseReported: false }]
  },
  ...[
    "https://www.hodinkee.com/articles/diving-with-the-new-tudor-pelagos-fxd",
    "https://www.hodinkee.com/articles/the-9-story-of-23-diving-with-the-new-tudor-pelagos-fxd"
  ].map((urlEquals) => ({
    urlEquals,
    records: [{ brand: "Tudor", model: "Pelagos FXD Black US Navy", reference: "M25717N-0001", lugToLugMm: 52, caseMm: 42, caseReported: false }]
  })),
  {
    urlIncludes: "doxa-sub-300-carbon-aqua-lung-us-divers-limited-edition-hands-on",
    records: [{ brand: "Doxa", model: "SUB 300 Carbon Aqua Lung US Divers Sharkhunter", reference: "822.70.101AQL.20", lugToLugMm: 44.5, caseMm: 42.5, caseReported: false }]
  },
  {
    urlIncludes: "doxa-sub-300-hands-on",
    records: ["821.10.351.10", "821.10.351.21"].map((reference) => ({ brand: "Doxa", model: "SUB 300 Professional", reference, lugToLugMm: 45, caseMm: 42.5, caseReported: false }))
  },
  {
    urlIncludes: "hands-on-albishorn-type-10",
    records: [{ brand: "Albishorn", model: "Air Collection Type 10 Classic", reference: "Type10 Classic", lugToLugMm: 47.7, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-doxa-sub-750t",
    records: [{ brand: "Doxa", model: "SUB 750T", reference: "SUB 750T", lugToLugMm: 47, caseMm: 45, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-grand-seiko-slga025g",
    records: [{ brand: "Grand Seiko", model: "Evolution 9 Collection Atera Blue", reference: "SLGA025", lugToLugMm: 47.9, caseMm: 40, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-longines-spirit-zulu-time-39-now-in-titanium",
    records: [{ brand: "Longines", model: "Spirit Zulu Time Titanium", reference: "L3.802.1.53.6", lugToLugMm: 46.7, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-longines-spirit-zulu-time-in-39mm",
    records: [{ brand: "Longines", model: "Spirit Zulu Time", reference: "L3.802.4.63.6", lugToLugMm: 46.7, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-omega-speedmaster-black-and-white",
    records: [{ brand: "Omega", model: "Speedmaster Moonwatch Professional White Lacquer", reference: "310.30.42.50.01.004", lugToLugMm: 47.5, caseMm: 42, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-spaceone-tellurium",
    records: [{ brand: "SpaceOne", model: "Tellurium", reference: "Tellurium", lugToLugMm: 50, caseMm: 42, caseReported: false }]
  },
  {
    urlIncludes: "hands-on-tudor-black-bay-chronograph",
    records: [{ brand: "Tudor", model: "Black Bay Chrono Blue Boutique Edition", reference: "79360B", lugToLugMm: 49.8, caseMm: 41, caseReported: false }]
  },
  {
    urlIncludes: "introducing-seiko-bamford-le-2025",
    records: [{ brand: "Seiko", model: "5 Sports Bamford Limited Edition", reference: "SBSA315", lugToLugMm: 46, caseMm: 42.5, caseReported: false }]
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/longines-for-hodinkee",
    records: [{ brand: "Longines", model: "Spirit Zulu Time Limited Edition for Hodinkee", reference: "L38021596", lugToLugMm: 46.7, caseMm: 39, thicknessMm: 13.5, lugWidthMm: 21 }]
  },
  {
    urlIncludes: "longines-legend-diver-back-and-better-at-39mm",
    records: [{ brand: "Longines", model: "Legend Diver 39 Blue", reference: "L3.764.4.90.6", lugToLugMm: 47, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "ming-1801-h41-divers-watch-in-titanium-hands-on",
    records: [{ brand: "Ming", model: "18 Series 18.01 H41", reference: "18.01 H41", lugToLugMm: 46, caseMm: 40, caseReported: false }]
  },
  {
    urlIncludes: "night-and-day-with-serica-8315-gmt-chronometer",
    records: ["8315-1", "8315-2"].map((reference) => ({ brand: "Serica", model: `${reference} GMT`, reference, lugToLugMm: 46.5, caseMm: 39, caseReported: false }))
  },
  {
    urlIncludes: "nomos-glashutte-refreshes-its-square-silhouette-with-the-tetra-origins-collection",
    records: [
      { brand: "NOMOS Glashütte", model: "Tetra Ochra", reference: "437", lugToLugMm: 40.5, caseMm: 29.5, thicknessMm: 6.5 },
      { brand: "NOMOS Glashütte", model: "Tetra Terra", reference: "438", lugToLugMm: 40.5, caseMm: 29.5, thicknessMm: 6.5 },
      { brand: "NOMOS Glashütte", model: "Tetra Salvia", reference: "439", lugToLugMm: 40.5, caseMm: 29.5, thicknessMm: 6.5 },
      { brand: "NOMOS Glashütte", model: "Tetra Basalt", reference: "440", lugToLugMm: 40.5, caseMm: 29.5, thicknessMm: 6.5 }
    ]
  },
  {
    urlIncludes: "omega-updates-the-speedmaster-dark-side-of-the-moon-for-2025",
    records: [
      "310.92.44.50.06.002",
      "310.92.44.51.01.001",
      "310.92.44.51.01.002",
      "310.92.44.51.01.003",
      "310.92.44.51.01.004",
      "310.92.44.51.01.005",
      "310.92.44.50.06.001"
    ].map((reference) => ({ brand: "Omega", model: "Speedmaster Dark Side of the Moon 2025", reference, lugToLugMm: 50, caseMm: 44.25, caseReported: false }))
  },
  {
    urlIncludes: "revisiting-a-week-on-the-wrist-tudor-black-bay-gmt-five-years-later-video",
    records: [{ brand: "Tudor", model: "Black Bay GMT", reference: "M79830RB", lugToLugMm: 50, caseMm: 41, caseReported: false }]
  },
  ...[
    "https://www.hodinkee.com/articles/tag-heuer-hodinkee",
    "https://www.hodinkee.com/articles/the-tag-heuer-carrera-chronograph-seafarer-hodinkee"
  ].map((urlEquals) => ({
    urlEquals,
    records: [{ brand: "TAG Heuer", model: "Carrera Chronograph Seafarer", reference: "CBS2016.EB0430", lugToLugMm: 48.6, caseMm: 42, caseReported: false }]
  })),
  ...[
    "https://www.hodinkee.com/articles/the-14-story-of-24-hands-on-with-the-tudor-black-bay-58-gmt",
    "https://www.hodinkee.com/articles/the-tudor-black-bay-58-gmt"
  ].map((urlEquals) => ({
    urlEquals,
    records: [{ brand: "Tudor", model: "Black Bay 58 GMT", reference: "M7939G1A0NRU-0001", lugToLugMm: 47.8, caseMm: 39, caseReported: false }]
  })),
  ...[
    "https://www.hodinkee.com/articles/the-23-story-of-24-hands-on-with-the-seiko-prospex-spb451-and-spb453",
    "https://www.hodinkee.com/articles/the-seiko-prospex-spb451-and-spb453"
  ].map((urlEquals) => ({
    urlEquals,
    records: ["SPB451", "SPB453"].map((reference) => ({ brand: "Seiko", model: "Prospex 1965 Heritage Diver's Watch", reference, lugToLugMm: 46.6, caseMm: 40, caseReported: false }))
  })),
  ...[
    "https://www.hodinkee.com/articles/the-8-story-of-25-in-depth-with-the-blancpain-grande-double-sonnerie",
    "https://www.hodinkee.com/articles/the-blancpain-grande-double-sonnerie"
  ].map((urlEquals) => ({
    urlEquals,
    records: ["15GSQ 1513 55B", "15GSQ 3613 55B"].map((reference) => ({ brand: "Blancpain", model: "Grande Double Sonnerie", reference, lugToLugMm: 54.6, caseMm: 47, caseReported: false }))
  })),
  {
    urlIncludes: "the-armin-strom-dual-time-gmt-resonance-manufacture-edition",
    records: [{ brand: "Armin Strom", model: "Dual Time GMT Resonance", reference: "ST25-DT.90", lugToLugMm: 44.5, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-breitling-navitimer-b01-chronograph-43-aston-martin-aramco-formula-one-team",
    records: [{ brand: "Breitling", model: "Navitimer B01 Chronograph 43 Aston Martin Aramco Formula One Team", reference: "EB01381A1B1X1", lugToLugMm: 49, caseMm: 43, caseReported: false }]
  },
  {
    urlIncludes: "the-bremont-supermarine-s302-gmt",
    records: [{ brand: "Bremont", model: "Supermarine S302 GMT", reference: "Supermarine S302 GMT", lugToLugMm: 49, caseMm: 40, caseReported: false }]
  },
  {
    urlIncludes: "the-carrera-calibre-5-date-may-not-be-a-chronograph",
    records: [
      { brand: "TAG Heuer", model: "Carrera Calibre 5 Date Black", reference: "WBN2110.BA0639", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.5 },
      { brand: "TAG Heuer", model: "Carrera Calibre 5 Date Blue", reference: "WBN2112.BA0639", lugToLugMm: 47, caseMm: 39, thicknessMm: 11.5 }
    ]
  },
  {
    urlIncludes: "the-doxa-sub-200-professional-value-proposition",
    records: [{ brand: "Doxa", model: "Sub 200 Professional", reference: "Sub 200 Professional", lugToLugMm: 45, caseMm: 42, caseReported: false }]
  },
  {
    urlEquals: "https://www.hodinkee.com/articles/the-doxa-sub-200-tgraph-ii",
    records: [{ brand: "Doxa", model: "SUB 200 T-Graph II", reference: "SUB 200 T-Graph II", lugToLugMm: 44.5, caseMm: 42, caseReported: false }]
  },
  {
    urlIncludes: "the-doxa-sub-250t-gmt-gulfshore-and-afterglow-limited-editions",
    records: [{ brand: "Doxa", model: "SUB 250T GMT Exquisite Gulfshore and Afterglow", reference: "SUB 250T GMT Exquisite", lugToLugMm: 42.9, caseMm: 40, caseReported: false }]
  },
  {
    urlIncludes: "the-haim-watch-co-annum",
    records: [{ brand: "Haim", model: "Annum", reference: "Annum", lugToLugMm: 45, caseMm: 38, caseReported: false }]
  },
  {
    urlIncludes: "the-longines-flagship-heritage-now-with-a-moonphase",
    records: ["L4.815.4.78.2", "L4.815.4.72.2", "L4.815.4.92.2"].map((reference) => ({ brand: "Longines", model: "Flagship Heritage Moonphase", reference, lugToLugMm: 47, caseMm: 38.5, caseReported: false }))
  },
  {
    urlIncludes: "the-longines-hydroconquest-39mm",
    records: [{ brand: "Longines", model: "HydroConquest", reference: "L3.779.4.90.6", lugToLugMm: 48.1, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-longines-legend-diver-gets-a-summer-ready-white-dial",
    records: [{ brand: "Longines", model: "Legend Diver 39 White", reference: "L3.764.4.16.6", lugToLugMm: 47, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-ming-1706-copper",
    records: [{ brand: "Ming", model: "17 Series 17.06 Copper", reference: "17.06 Copper", lugToLugMm: 43.9, caseMm: 38, caseReported: false }]
  },
  {
    urlIncludes: "the-nodus-trailtrekker",
    records: [{ brand: "Nodus x Raven", model: "TrailTrekker", reference: "TrailTrekker", lugToLugMm: 46.6, caseMm: 39.5, caseReported: false }]
  },
  {
    urlIncludes: "the-omega-constellation-globemaster-is-the-perfect-balance-of-classic-and-cutting-edge",
    records: [{ brand: "Omega", model: "Constellation Globemaster", reference: "130.30.39.21.03.001", lugToLugMm: 47, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-omega-speedmaster-dark-side-of-the-moon-apollo-8-gets-serious-upgrades",
    records: [{ brand: "Omega", model: "Speedmaster Dark Side of the Moon Apollo 8", reference: "310.92.44.50.01.001", lugToLugMm: 50, caseMm: 44.25, caseReported: false }]
  },
  {
    urlIncludes: "the-ressence-type-11",
    records: [{ brand: "Ressence", model: "Type 11", reference: "Type 11", lugToLugMm: 45, caseMm: 41, caseReported: false }]
  },
  {
    urlIncludes: "the-timex-giorgio-galli-s2ti",
    records: [{ brand: "Timex", model: "Giorgio Galli S2 Ti Titanium", reference: "Giorgio Galli S2 Ti", lugToLugMm: 46, caseMm: 38, caseReported: false }]
  },
  {
    urlIncludes: "the-tudor-black-bay-54-doesnt-waste-a-millimeter",
    records: [{ brand: "Tudor", model: "Black Bay 54", reference: "M79000N-0001", lugToLugMm: 46, caseMm: 37, caseReported: false }]
  },
  {
    urlIncludes: "the-tudor-black-bay-chrono-39-bumblebee-2",
    records: [{ brand: "Tudor", model: "Black Bay Chrono 39 Bumblebee", reference: "Black Bay Chrono 39 Bumblebee", lugToLugMm: 47, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-tudor-monarch",
    records: [{ brand: "Tudor", model: "Monarch", reference: "2639W1A0U / 26060", lugToLugMm: 46.2, caseMm: 39, caseReported: false }]
  },
  {
    urlIncludes: "the-tudor-pelagos-fxd-gmt",
    records: [{ brand: "Tudor", model: "Pelagos FXD GMT", reference: "Pelagos FXD GMT", lugToLugMm: 52, caseMm: 42, caseReported: false }]
  },
  {
    urlIncludes: "the-zenith-chronomaster-original-triple-calendar-lapis-lazuli",
    records: [{ brand: "Zenith", model: "Chronomaster Original Triple Calendar Lapis Lazuli", reference: "03.3400.3610/51.C910", lugToLugMm: 46, caseMm: 38, caseReported: false }]
  },
  {
    urlIncludes: "travel-timing-with-timexs-q-three-time-zone-chronograph",
    records: [{ brand: "Timex", model: "Q Three Time Zone Chronograph", reference: "Q Three Time Zone Chronograph", lugToLugMm: 46.3, caseMm: 40, caseReported: false }]
  },
  {
    urlIncludes: "vintage-or-modern-the-new-nivada-grenchen-antarctic-35mm",
    records: [{ brand: "Nivada Grenchen", model: "Antarctic 35mm", reference: "Antarctic 35mm", lugToLugMm: 42, caseMm: 35, caseReported: false }]
  },
  {
    urlIncludes: "zenith-defy-skyline-2022-time-only-el-primero",
    records: [
      ["Defy Skyline Silver", "03.9300.3620/01.I001"],
      ["Defy Skyline Blue", "03.9300.3620/51.I001"],
      ["Defy Skyline Black", "03.9300.3620/21.I001"]
    ].map(([model, reference]) => ({ brand: "Zenith", model, reference, lugToLugMm: 46, caseMm: 41, thicknessMm: 12 }))
  }
];

const manualErrors = [];
const semanticReviewedUrls = new Set();
let semanticReviewedRecordCount = 0;
for (const definition of [...manualDefinitions, ...reviewedIndirectDefinitions, ...reviewedDirectDefinitions]) {
  const result = findManualCandidate(definition);
  if (result.error) {
    manualErrors.push(result.error);
    continue;
  }
  const candidate = result.candidate;
  const rejected = rejectedReason(candidate.url);
  if (rejected) {
    report.excluded.push({ url: candidate.url, title: candidate.title, reason: rejected });
    continue;
  }
  for (const record of definition.records) {
    if (
      !record.semantic &&
      !record.allowUnparsed &&
      !candidate.directLugToLugValues.some((value) => Math.abs(value - record.lugToLugMm) <= 0.1)
    ) {
      manualErrors.push(
        `Manual value ${record.lugToLugMm}mm is absent from ${candidate.url}: ${candidate.directLugToLugValues.join(", ")}`
      );
      continue;
    }
    applyRecord(record, candidate);
    if (record.semantic && !candidate.signals.includes("direct-lug-to-lug")) {
      semanticReviewedUrls.add(normalizedUrl(candidate.url));
      semanticReviewedRecordCount += 1;
    }
  }
}

if (manualErrors.length) throw new Error(`Manual review table errors:\n- ${manualErrors.join("\n- ")}`);

for (const [fragment, reason] of rejectedArticleFragments) {
  const candidates = summary.candidates.filter((item) => matchesArticleLocator(item.url, fragment));
  for (const candidate of candidates) {
    if (!report.excluded.some((item) => item.url === candidate.url)) {
      report.excluded.push({ url: candidate.url, title: candidate.title, reason });
    }
  }
}

watches.sort((left, right) => Number(left.id) - Number(right.id));
const importedSourceUrls = new Set(
  watches.flatMap((watch) => watch.sources).map((source) => normalizedUrl(source.sourceUrl))
);
const indirectCandidates = summary.candidates.filter(
  (candidate) => !candidate.signals.includes("direct-lug-to-lug")
);
report.indirectArticleReview = {
  candidateCount: indirectCandidates.length,
  semanticCaseLengthCandidateCount: indirectCandidates.filter((candidate) =>
    candidate.signals.includes("semantic-case-length")
  ).length,
  dimensionPairCandidateCount: indirectCandidates.filter((candidate) =>
    candidate.signals.includes("dimension-pair")
  ).length,
  sourceCoveredCandidateCount: indirectCandidates.filter((candidate) =>
    importedSourceUrls.has(normalizedUrl(candidate.url))
  ).length,
  reviewedPlanarArticleCount: semanticReviewedUrls.size,
  reviewedPlanarRecordCount: semanticReviewedRecordCount,
  policy:
    "Only explicit planar case length, top-to-bottom, end-to-end, or shaped-case dimensions were imported; height/tall language denoting thickness was excluded."
};
const directCandidates = summary.candidates.filter((candidate) => candidate.signals.includes("direct-lug-to-lug"));
const uncoveredDirectCandidates = directCandidates.filter(
  (candidate) => !importedSourceUrls.has(normalizedUrl(candidate.url))
);
const explicitlyExcludedUrls = new Set(report.excluded.map((item) => normalizedUrl(item.url)));
report.directArticleCoverage = {
  candidateCount: directCandidates.length,
  coveredCount: directCandidates.length - uncoveredDirectCandidates.length,
  explicitlyExcludedCount: uncoveredDirectCandidates.filter((candidate) =>
    explicitlyExcludedUrls.has(normalizedUrl(candidate.url))
  ).length,
  nonNumericMentionCount: uncoveredDirectCandidates.filter(
    (candidate) =>
      !explicitlyExcludedUrls.has(normalizedUrl(candidate.url)) && candidate.directLugToLugValues.length === 0
  ).length,
  unresolvedNumericCount: uncoveredDirectCandidates.filter(
    (candidate) =>
      !explicitlyExcludedUrls.has(normalizedUrl(candidate.url)) && candidate.directLugToLugValues.length > 0
  ).length
};
report.nonNumericDirectArticles = uncoveredDirectCandidates
  .filter(
    (candidate) =>
      !explicitlyExcludedUrls.has(normalizedUrl(candidate.url)) && candidate.directLugToLugValues.length === 0
  )
  .map((candidate) => ({
    url: candidate.url,
    title: candidate.title,
    extractedValues: candidate.directLugToLugValues,
    reason: "The article uses lug-to-lug terminology without supplying a numeric planar case length."
  }));
report.unresolvedNumericDirectArticles = uncoveredDirectCandidates
  .filter(
    (candidate) =>
      !explicitlyExcludedUrls.has(normalizedUrl(candidate.url)) && candidate.directLugToLugValues.length > 0
  )
  .map((candidate) => ({
    url: candidate.url,
    title: candidate.title,
    extractedValues: candidate.directLugToLugValues,
    reason: "A numeric lug-to-lug mention remains unresolved."
  }));
report.finalSeedCount = watches.length;
report.addedCount = report.added.length;
report.augmentedCount = report.augmented.length;
report.correctedCount = report.corrected.length;
report.sourceCorrectionCount = report.sourceCorrections.length;
report.conflictCount = report.conflicts.length;
report.excludedCount = report.excluded.length;

if (apply) await writeFile(seedPath, `${JSON.stringify(watches, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${apply ? "Applied" : "Prepared"} Hodinkee import: ${report.addedCount} added, ${report.augmentedCount} source augmentations, ` +
    `${report.correctedCount} metric corrections, ${report.sourceCorrectionCount} source corrections, ` +
    `${report.conflictCount} conflicts, ${report.excludedCount} explicit exclusions.\n`
);

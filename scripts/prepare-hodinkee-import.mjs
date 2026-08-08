import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import seed from "../data/watches.seed.json" with { type: "json" };

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const inputPath = resolve(argumentValue("input") ?? "/private/tmp/hodinkee-lug-candidates.json");
const outputPath = resolve(argumentValue("output") ?? "/private/tmp/hodinkee-lug-proposals.json");

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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function factValues(candidate, labels) {
  const normalizedLabels = new Set(labels.map((label) => label.toLowerCase()));
  return unique(
    candidate.facts
      .filter((fact) => normalizedLabels.has(fact.label.toLowerCase()))
      .map((fact) => fact.value.trim().normalize("NFC"))
  );
}

function firstNumber(value) {
  const match = String(value ?? "").match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:mm|millimeters?)?\b/iu);
  return match ? Number(match[1]) : null;
}

function millimeterNumbers(value) {
  return [...String(value ?? "").matchAll(/\b(\d{1,2}(?:\.\d+)?)\s*(?:mm|millimeters?)\b/giu)].map((match) =>
    Number(match[1])
  );
}

function referencesFromFacts(candidate) {
  const references = factValues(candidate, ["reference", "reference number"]);
  const tokens = [];

  for (const reference of references) {
    for (const match of reference.matchAll(/\b(?=[A-Z0-9./-]{3,}\b)(?=[A-Z0-9./-]*\d)[A-Z0-9]+(?:[./-][A-Z0-9]+)*\b/giu)) {
      const token = match[0].replace(/[.,;]+$/gu, "");
      if (/^(?:19|20)\d{2}$/u.test(token) || /^\d+(?:\.\d+)?mm$/iu.test(token)) continue;
      tokens.push(token);
    }
  }

  return unique(tokens);
}

function sourceNote({ brand, model, references, lugToLugMm, caseMm, thicknessMm, lugWidthMm, approximate }) {
  const identity = references.length ? ` reference${references.length > 1 ? "s" : ""} ${references.join(", ")}` : "";
  const metrics = [
    `${approximate ? "approximately " : ""}${lugToLugMm}mm lug-to-lug`,
    caseMm == null ? null : `${caseMm}mm case size`,
    thicknessMm == null ? null : `${thicknessMm}mm thickness`,
    lugWidthMm == null ? null : `${lugWidthMm}mm lug width`
  ].filter(Boolean);
  return `Hodinkee identifies ${brand} ${model}${identity} and reports ${metrics.join(", ")}.`;
}

function brandRelated(left, right) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (
    normalizedLeft === normalizedRight ||
    (normalizedLeft.length >= 4 && normalizedRight.includes(normalizedLeft)) ||
    (normalizedRight.length >= 4 && normalizedLeft.includes(normalizedRight))
  );
}

function existingMatches({ brand, model, references, caseMm, lugToLugMm }) {
  const normalizedBrand = normalize(brand);
  const referenceKeys = references.map(compact);
  const normalizedModel = normalize(model);

  const referenceMatches = referenceKeys.length
    ? seed.filter((watch) => {
        const key = compact(watch.reference);
        if (!referenceKeys.includes(key)) return false;
        const crossBrandReferenceIsDistinctive = /[a-z]/u.test(key) && /\d/u.test(key) && key.length >= 5;
        return normalize(watch.brand) === normalizedBrand || crossBrandReferenceIsDistinctive;
      })
    : [];
  if (referenceMatches.length) return referenceMatches;

  const modelMatches = seed.filter((watch) => {
    if (!brandRelated(watch.brand, brand)) return false;
    const watchModel = normalize(watch.canonicalModel ?? watch.model);
    const modelRelated =
      watchModel === normalizedModel ||
      (watchModel.length >= 8 && normalizedModel.includes(watchModel)) ||
      (normalizedModel.length >= 8 && watchModel.includes(normalizedModel));
    if (!modelRelated) return false;
    const caseAgrees = caseMm == null || watch.caseMm == null || Math.abs(Number(watch.caseMm) - caseMm) <= 0.25;
    const lugToLugAgrees = Math.abs(Number(watch.lugToLugMm) - lugToLugMm) <= 0.5;
    return caseAgrees && lugToLugAgrees;
  });
  return unique(modelMatches.map((watch) => watch.id)).map((id) =>
    seed.find((watch) => watch.id === id)
  );
}

const summary = JSON.parse(await readFile(inputPath, "utf8"));
const proposals = [];
const excluded = [];

for (const candidate of summary.candidates) {
  if (!candidate.signals.includes("direct-lug-to-lug")) continue;
  if (candidate.directLugToLugValues.length !== 1) {
    excluded.push({ url: candidate.url, title: candidate.title, reason: "zero-or-multiple-direct-values" });
    continue;
  }

  const brands = factValues(candidate, ["brand"]);
  const models = factValues(candidate, ["model"]);
  if (brands.length !== 1 || models.length !== 1) {
    excluded.push({ url: candidate.url, title: candidate.title, reason: "missing-or-multiple-structured-identities" });
    continue;
  }

  const brand = brands[0];
  const model = models[0];
  const references = referencesFromFacts(candidate);
  const lugToLugMm = candidate.directLugToLugValues[0];
  const diameterFacts = factValues(candidate, ["diameter", "case diameter", "case size"]);
  const caseMm = firstNumber(diameterFacts[0]);
  const thicknessMm = firstNumber(factValues(candidate, ["thickness"])[0]);
  const lugWidthMm = firstNumber(factValues(candidate, ["lug width"])[0]);
  const mentionContexts = candidate.contexts.flatMap((context) => context.directLugToLugMentions);
  const approximate = mentionContexts.some(
    (mention) =>
      mention.approximate ||
      /\b(?:less|more)\s+than\b|\b(?:under|over)\s+\d|\b(?:about|around|approximately|roughly)\b/iu.test(
        mention.context
      )
  );
  const complexIdentity =
    millimeterNumbers(diameterFacts[0]).length > 1 ||
    (references.length > 1 && /(?:,|\band\b)/iu.test(model));
  const existing = existingMatches({ brand, model, references, caseMm, lugToLugMm });
  const valuesAgree = existing.every((watch) => Math.abs(Number(watch.lugToLugMm) - lugToLugMm) <= 0.5);
  const alreadySourced = existing.some((watch) =>
    watch.sources.some((source) => source.sourceUrl.replace(/\/$/u, "") === candidate.url.replace(/\/$/u, ""))
  );

  proposals.push({
    action: complexIdentity
      ? "manual-complex"
      : alreadySourced
        ? "already-sourced"
        : existing.length
          ? valuesAgree
            ? "augment"
            : "conflict"
          : "add",
    url: candidate.url,
    title: candidate.title,
    publishedAt: candidate.publishedAt,
    brand,
    model,
    references,
    fallbackReference: references.length ? null : model,
    lugToLugMm,
    caseMm,
    thicknessMm,
    lugWidthMm,
    approximate,
    sourceNote: sourceNote({
      brand,
      model,
      references,
      lugToLugMm,
      caseMm,
      thicknessMm,
      lugWidthMm,
      approximate
    }),
    existing: existing.map((watch) => ({
      id: watch.id,
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      lugToLugMm: watch.lugToLugMm,
      caseMm: watch.caseMm
    })),
    mentionContexts: mentionContexts.map((mention) => mention.context)
  });
}

const actionCounts = Object.fromEntries(
  ["add", "augment", "conflict", "already-sourced", "manual-complex"].map((action) => [
    action,
    proposals.filter((proposal) => proposal.action === action).length
  ])
);
const output = {
  generatedAt: new Date().toISOString(),
  inputPath,
  directCandidateCount: summary.directCandidateCount,
  structuredProposalCount: proposals.length,
  actionCounts,
  excludedCount: excluded.length,
  proposals,
  excluded
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
  `Prepared ${proposals.length} structured proposals (${JSON.stringify(actionCounts)}); ` +
    `${excluded.length} direct candidates require manual review.\n`
);

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import seed from "../data/watches.seed.json" with { type: "json" };

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const inputPath = resolve(argumentValue("input") ?? "/private/tmp/hodinkee-lug-audit.json");
const outputPath = resolve(argumentValue("output") ?? "/private/tmp/hodinkee-lug-candidates.json");

function compactReference(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function normalizedWords(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

const MODEL_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "automatic",
  "edition",
  "for",
  "hands",
  "in",
  "introducing",
  "limited",
  "live",
  "mm",
  "of",
  "on",
  "ref",
  "reference",
  "review",
  "the",
  "watch",
  "with"
]);

function modelTokens(value) {
  return normalizedWords(value)
    .split(" ")
    .filter((word) => word.length >= 2 && !MODEL_STOP_WORDS.has(word));
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ""))];
}

function millimeterValues(value) {
  return [...value.matchAll(/\b(\d{1,2}(?:\.\d+)?)\s*mm\b/giu)].map((match) => Number(match[1]));
}

function plausibleLugToLugValues(values) {
  return unique(values).filter((value) => Number.isFinite(value) && value >= 15 && value <= 75);
}

function valuesFromLugToLugFact(value) {
  const values = [];

  // HODINKEE sometimes omits the repeated `mm` in multi-size tables, for
  // example: "47mm (40), 42.2 (36), 35.8 (30)". Numbers outside the
  // parentheses are the measurements; parenthesized numbers name the case
  // size to which each measurement applies.
  for (const match of value.matchAll(/(?<!\()\b(\d{1,2}(?:\.\d+)?)\s*(?:mm\b|(?=\s*\())/giu)) {
    values.push(Number(match[1]));
  }

  return plausibleLugToLugValues(values);
}

const DIRECT_LUG_TO_LUG_SOURCE = String.raw`(?:\bl\s*2\s*l\b|lug(?:\s|\u00a0|[-\u2010-\u2015])*to(?:\s|\u00a0|[-\u2010-\u2015])*lug)`;

function directLugToLugMentions(context) {
  const mentions = [];
  const lines = context.split("\n").filter((line) => new RegExp(DIRECT_LUG_TO_LUG_SOURCE, "iu").test(line));
  const directPattern = new RegExp(DIRECT_LUG_TO_LUG_SOURCE, "giu");
  const valuePattern = /\b(\d{1,2}(?:\.\d+)?)\s*(?:mm|millimeters?)\b/giu;
  const approximatePattern = /\b(?:about|around|approximately|roughly|just\s+(?:over|under)|a\s+hair\s+under)\b/iu;

  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/u);
    for (const sentence of sentences) {
      if (!new RegExp(DIRECT_LUG_TO_LUG_SOURCE, "iu").test(sentence)) continue;
      if (
        /\b(?:do(?:es)?\s+not|don[’']t|doesn[’']t)\s+(?:yet\s+)?(?:have|list|publish|provide)|\b(?:not|never)\s+(?:published|provided|available|known|stated)|\bunstated\b|\bunknown\b/iu.test(
          sentence
        )
      ) {
        continue;
      }

      for (const phrase of sentence.matchAll(directPattern)) {
        const before = sentence.slice(Math.max(0, phrase.index - 100), phrase.index);
        const after = sentence.slice(phrase.index + phrase[0].length, phrase.index + phrase[0].length + 220);
        const values = [];

        // A value immediately before the phrase: "47.5mm lug-to-lug".
        const beforeMatch = before.match(
          /(?:about|around|approximately|roughly|just\s+(?:over|under)|a\s+hair\s+under)?\s*(\d{1,2}(?:\.\d+)?)\s*(?:mm|millimeters?)\s*(?:in\s+length|long|length|measurement|of|from)?[\s(\[,\-\u2010-\u2015:]*$/iu
        ) ??
          before.match(
            /\b(\d{1,2}(?:\.\d+)?)\s*(?:from)?[\s(\[,\-\u2010-\u2015:]*$/iu
          );
        // Values after the phrase, stopping when a different case metric
        // begins. This preserves transitions such as "from 50.3mm to 48mm"
        // and bracelet/end-link alternatives while excluding nearby case
        // diameter, thickness, and lug-width figures.
        const afterMetricWindow = after.split(
          /(?<!\d)\.(?=\s|$)|;|\b(?:case\s+(?:diameter|size|width)|diameter|thickness|lug\s+width|between\s+the\s+lugs)\b/iu,
          1
        )[0];
        const commaSegments = afterMetricWindow.split(",");
        let firstMeasurementSegment = commaSegments.findIndex((segment) => {
          valuePattern.lastIndex = 0;
          return valuePattern.test(segment);
        });
        valuePattern.lastIndex = 0;
        if (firstMeasurementSegment < 0) firstMeasurementSegment = 0;
        let afterWindow = commaSegments.slice(0, firstMeasurementSegment + 1).join(",");
        for (const segment of commaSegments.slice(firstMeasurementSegment + 1)) {
          if (!/\b(?:with|without|versus|vs\.?|or|to)\b/iu.test(segment)) break;
          afterWindow += `,${segment}`;
        }

        // Prefer a value grammatically attached after the phrase. This is
        // essential for HODINKEE fact-table lines such as
        // "Diameter: 40mm (lug to lug: 48mm)" where the number immediately
        // before the phrase is the case width, not the lug-to-lug value.
        const afterStartsWithMeasurement = new RegExp(
          String.raw`^[\s()\[\],:\-\u2010-\u2015]*(?:(?:measurement|measure|length|figure|dimension)(?:\s+(?:is|of|at|comes\s+in\s+at|changes?\s+from))?|(?:is|of|at|measures?|from|comes\s+in\s+at))?[\s()\[\],:\-\u2010-\u2015]*(?:about|around|approximately|roughly|just\s+(?:over|under)|a\s+hair\s+under)?\s*\d{1,2}(?:\.\d+)?\s*(?:mm|millimeters?)\b`,
          "iu"
        ).test(afterWindow);

        if (afterStartsWithMeasurement) {
          for (const valueMatch of afterWindow.matchAll(valuePattern)) values.push(Number(valueMatch[1]));
        } else if (beforeMatch) {
          values.push(Number(beforeMatch[1]));
        }

        for (const value of plausibleLugToLugValues(values)) {
          const key = `${value}|${sentence}`;
          if (mentions.some((mention) => mention.key === key)) continue;
          mentions.push({
            key,
            value,
            approximate: approximatePattern.test(`${before} ${afterWindow}`),
            context: sentence.slice(0, 2_000)
          });
        }
      }
    }
  }

  return mentions.map(({ key: _key, ...mention }) => mention);
}

function factsFromText(text) {
  const wantedLabels = new Set([
    "brand",
    "model",
    "reference",
    "reference number",
    "diameter",
    "case diameter",
    "case size",
    "case dimensions",
    "dimensions",
    "thickness",
    "height",
    "length",
    "lug to lug",
    "lug-to-lug",
    "lug width",
    "strap/bracelet"
  ]);
  const facts = [];

  for (const line of text.split("\n")) {
    const match = line.match(/^([^:]{2,32}):\s*(.+)$/u);
    if (!match || !wantedLabels.has(match[1].trim().toLowerCase())) continue;
    facts.push({ label: match[1].trim(), value: match[2].trim().slice(0, 500) });
  }

  return facts;
}

function referencesFromFacts(facts) {
  return unique(
    facts
      .filter((fact) => /^reference(?: number)?$/iu.test(fact.label))
      .flatMap((fact) => fact.value.split(/\s*(?:\||,|\band\b)\s*/iu))
      .map((value) => value.replace(/^ref(?:erence)?\.?\s*/iu, "").trim())
  );
}

function seedMatches(candidate, facts) {
  const sourceMatches = seed.filter((watch) =>
    watch.sources.some((source) => source.sourceUrl.replace(/\/$/u, "") === candidate.url.replace(/\/$/u, ""))
  );
  const references = referencesFromFacts(facts).map(compactReference).filter(Boolean);
  const referenceMatches = references.length
    ? seed.filter((watch) => references.includes(compactReference(watch.reference)))
    : [];

  return unique([...sourceMatches, ...referenceMatches].map((watch) => watch.id)).map((id) => {
    const watch = seed.find((candidateWatch) => candidateWatch.id === id);
    return {
      id: watch.id,
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      lugToLugMm: watch.lugToLugMm,
      matchedBySource: sourceMatches.some((sourceMatch) => sourceMatch.id === id),
      matchedByReference: referenceMatches.some((referenceMatch) => referenceMatch.id === id)
    };
  });
}

const preparedSeed = seed.map((watch) => ({
  watch,
  brand: normalizedWords(watch.brand),
  model: normalizedWords(watch.canonicalModel ?? watch.model),
  modelTokens: modelTokens(watch.canonicalModel ?? watch.model),
  reference: compactReference(watch.reference),
  referenceEligible: compactReference(watch.reference).length >= 4 && /\d/u.test(watch.reference)
}));

function fuzzySeedMatches(candidate, facts, exactMatches) {
  const factText = facts.map((fact) => `${fact.label} ${fact.value}`).join(" ");
  const haystack = normalizedWords(`${candidate.title ?? ""} ${factText}`);
  const compactHaystack = compactReference(haystack);
  const exactIds = new Set(exactMatches.map((watch) => watch.id));

  return preparedSeed
    .map((prepared) => {
      if (exactIds.has(prepared.watch.id)) return null;
      let score = 0;
      const reasons = [];
      let matchedReference = false;
      let matchedBrand = false;
      if (prepared.referenceEligible && compactHaystack.includes(prepared.reference)) {
        score += 100;
        matchedReference = true;
        reasons.push("reference-in-article-metadata");
      }
      if (prepared.brand && (` ${haystack} `).includes(` ${prepared.brand} `)) {
        score += 20;
        matchedBrand = true;
        reasons.push("brand-in-title-or-facts");
      }
      if (prepared.model && (` ${haystack} `).includes(` ${prepared.model} `)) {
        score += 30;
        reasons.push("model-phrase-in-title-or-facts");
      } else if (prepared.modelTokens.length) {
        const matches = prepared.modelTokens.filter((token) => (` ${haystack} `).includes(` ${token} `));
        const requiredMatches = Math.min(2, prepared.modelTokens.length);
        if (matches.length >= requiredMatches) {
          score += matches.length * 5;
          reasons.push(`model-tokens:${matches.join(",")}`);
        }
      }
      if (score < 30 || (!matchedReference && !matchedBrand)) return null;
      return {
        id: prepared.watch.id,
        brand: prepared.watch.brand,
        model: prepared.watch.model,
        reference: prepared.watch.reference,
        lugToLugMm: prepared.watch.lugToLugMm,
        score,
        reasons
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || left.id - right.id)
    .slice(0, 8);
}

const audit = JSON.parse(await readFile(inputPath, "utf8"));
const candidates = audit.candidates.map((candidate) => {
  const facts = factsFromText(candidate.text);
  const lugToLugFacts = facts
    .filter((fact) => /^lug(?:\s|-)*to(?:\s|-)*lug$/iu.test(fact.label))
    .map((fact) => ({ ...fact, values: valuesFromLugToLugFact(fact.value) }));
  const exactSeedMatches = seedMatches(candidate, facts);
  const contexts = candidate.contexts.map((item) => ({
    ...item,
    millimeterValues: unique(millimeterValues(item.context)),
    directLugToLugMentions: item.signals.includes("direct-lug-to-lug")
      ? directLugToLugMentions(item.context)
      : []
  }));

  return {
    url: candidate.url,
    title: candidate.title,
    publishedAt: candidate.publishedAt,
    lastModified: candidate.lastModified,
    signals: candidate.signals,
    facts,
    lugToLugFacts,
    contexts,
    contextMillimeterValues: unique(contexts.flatMap((context) => context.millimeterValues)),
    directLugToLugValues: unique([
      ...lugToLugFacts.flatMap((fact) => fact.values),
      ...contexts.flatMap((context) => context.directLugToLugMentions.map((mention) => mention.value))
    ]),
    seedMatches: exactSeedMatches,
    fuzzySeedMatches: fuzzySeedMatches(candidate, facts, exactSeedMatches)
  };
});

const output = {
  generatedAt: new Date().toISOString(),
  auditGeneratedAt: audit.generatedAt,
  sitemapArticleCount: audit.sitemapArticleCount,
  completedArticleCount: audit.completedArticleCount,
  failureCount: audit.failureCount,
  candidateCount: candidates.length,
  directCandidateCount: candidates.filter((candidate) => candidate.signals.includes("direct-lug-to-lug")).length,
  candidates
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(
  `Summarized ${candidates.length} candidates (${output.directCandidateCount} direct) to ${outputPath}.\n`
);

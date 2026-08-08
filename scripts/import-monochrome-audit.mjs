import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function argumentValue(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

const summaryPath = resolve(argumentValue("input") ?? "/private/tmp/monochrome-lug-candidates.json");
const seedPath = resolve(argumentValue("seed") ?? "data/watches.seed.json");
const reportPath = resolve(argumentValue("report") ?? "/private/tmp/monochrome-import-report.json");
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
  const key = compact(value);
  const aliases = new Map([
    ["iwcschaffhausen", "iwc"],
    ["tagheuer", "tagheuer"],
    ["frederiqueconstant", "frederiqueconstant"],
    ["hmosercie", "hmosercie"],
    ["glashutteoriginal", "glashutteoriginal"],
    ["grandseiko", "grandseiko"],
    ["leboisco", "leboisco"],
    ["mauricelacroix", "mauricelacroix"],
    ["parmigianifleurier", "parmigianifleurier"],
    ["reservoirwatches", "reservoir"],
    ["ecandersson", "ecandersson"]
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

function sameMetric(left, right, tolerance = 0.5) {
  return left == null || right == null || Math.abs(Number(left) - Number(right)) <= tolerance;
}

function sourceAlreadyPresent(watch, url) {
  const key = normalizedUrl(url);
  return watch.sources.some((source) => normalizedUrl(source.sourceUrl) === key);
}

const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const watches = JSON.parse(await readFile(seedPath, "utf8"));
let nextId = Math.max(...watches.map((watch) => Number(watch.id))) + 1;
const sourceUrlsAtStart = new Set(
  watches.flatMap((watch) => watch.sources.map((source) => normalizedUrl(source.sourceUrl)))
);
const addedThisRunIds = new Set();

const genericCategories = new Set([
  "buying guide",
  "industry news",
  "kickstarter",
  "monochrome video",
  "novelties",
  "podcast",
  "recap",
  "the horology club hong kong",
  "the collector's series",
  "the petrolhead corner",
  "watch info",
  "watch reviews"
]);

const knownBrands = unique(watches.map((watch) => watch.brand));
const watchesByBrandKey = new Map();
for (const watch of watches) {
  const key = brandKey(watch.brand);
  const matches = watchesByBrandKey.get(key) ?? [];
  matches.push(watch);
  watchesByBrandKey.set(key, matches);
}

function brandWatches(brands) {
  if (!brands.length) return watches;
  return unique(
    brands.flatMap((brand) => {
      const exact = watchesByBrandKey.get(brandKey(brand));
      if (exact) return exact.map((watch) => watch.id);
      return watches.filter((watch) => brandRelated(watch.brand, brand)).map((watch) => watch.id);
    })
  ).map((id) => watches.find((watch) => watch.id === id));
}

function candidateBrands(candidate) {
  const categories = candidate.categories.filter((category) => !genericCategories.has(normalize(category)));
  const matched = categories.filter((category) => knownBrands.some((brand) => brandRelated(brand, category)));
  if (matched.length) return unique(matched);
  return categories.length === 1 ? categories : [];
}

function highConfidenceReferenceTokens(value) {
  const tokens = [];
  const text = String(value ?? "");
  const pattern = /\b[A-Z0-9]+(?:[./-][A-Z0-9]+)*\b/giu;

  for (const match of text.matchAll(pattern)) {
    const token = match[0].replace(/[.,;:]+$/gu, "");
    const key = token.toUpperCase();
    const letters = token.replace(/[^A-Z]/giu, "");
    if (token.length < 4 || !/[A-Z]/iu.test(token) || !/\d/u.test(token)) continue;
    if (/^\d/u.test(token) && letters !== letters.toUpperCase()) continue;
    if (/^(?:19|20)\d{2}S?$/u.test(key)) continue;
    if (/^\d+(?:ST|ND|RD|TH)(?:-.+)?$/u.test(key)) continue;
    if (/^\d+-(?:YEAR|DIGIT)$/u.test(key)) continue;
    if (/^(?:904L|316L|SUS316L)$/u.test(key)) continue;
    if (/^\d+(?:\.\d+)?(?:MM|M|KM|BAR|ATM|TH|K)$/u.test(key)) continue;
    if (/^(?:\d+ON\d+|\d+S-?[A-Z]+|STYLE\d+|SUB-?\d+K)$/u.test(key)) continue;
    if (/^(?:GMT-?\d*|H2O|L2L|3D|4K|80S)$/u.test(key)) continue;
    if (/^(?:44GS|62MAS|BGW9|EVO9|CMM[.-]?\d+|9S[A-Z0-9]+|\d{1,2}TH|ST\d+)$/u.test(key)) continue;
    if (/^(?:REF|CALIBRE|CALIBER)\d+$/u.test(key)) continue;
    tokens.push(token);
  }

  return unique(tokens.map((token) => token.normalize("NFC")));
}

function articleReferences(candidate) {
  return highConfidenceReferenceTokens(candidate.title);
}

function cleanModelTitle(title, brand) {
  let value = String(title ?? "")
    .replace(/\s*\((?:live|video|incl\.|including|hands-on|review|specs|price|pics)[^)]*\)\s*$/iu, "")
    .replace(
      /^(?:(?:going\s+hands[- ]?on|hands[- ]?on|first look|introducing|review|value proposition|video review|a personal take on|diving with|hands[- ]?on review|review of)\s*(?:with|of)?\s*[-\u2010-\u2015:]?\s*)+/iu,
      ""
    )
    .replace(/^(?:the\s+)?(?:all[- ]new|brand[- ]new|new|updated|cool)\s+/iu, "")
    .trim();

  const dashParts = value.split(/\s+[-\u2010-\u2015]\s+/u);
  if (dashParts.length > 1 && brandRelated(dashParts[0], brand)) value = dashParts[0];

  const brandPattern = normalize(brand)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
    .join("[\\s&.\\-]*");
  if (brandPattern) value = value.replace(new RegExp(`^(?:the\\s+)?${brandPattern}\\s+`, "iu"), "");

  return value
    .replace(/^(?:the|a|an)\s+/iu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 180);
}

function unitNumberPattern() {
  return String.raw`(\d{1,2}(?:[.,]\d+)?)\s*(?:mm|millimet(?:er|re)s?)`;
}

function numeric(value) {
  return Number(String(value).replace(",", "."));
}

function metricContext(candidate) {
  const directMentionSentences = candidate.contexts.flatMap((context) =>
    (context.directLugToLugMentions ?? []).map((mention) => mention.context)
  );
  const values = directMentionSentences.length
    ? directMentionSentences
    : candidate.contexts.filter((context) => context.signals.includes("direct-lug-to-lug")).map((context) => context.context);
  return values
    .join("\n")
    .replace(/(?<=\d),(?=\d)/gu, ".");
}

function extractedMetrics(candidate, lugToLugMm) {
  const context = metricContext(candidate);
  const unit = unitNumberPattern();
  const caseValues = [];
  const thicknessValues = [];
  const lugWidthValues = [];

  const pairPattern = new RegExp(
    String.raw`\b${unit}\s*(?:[x\u00d7]|by)\s*${unit}(?:\s*(?:[x\u00d7]|by)\s*${unit})?\b`,
    "giu"
  );
  for (const match of context.matchAll(pairPattern)) {
    const values = [numeric(match[1]), numeric(match[2]), match[3] == null ? null : numeric(match[3])].filter(
      (value) => value != null
    );
    if (values.some((value) => Math.abs(value - lugToLugMm) <= 0.05)) {
      const planar = values.find((value) => value >= 15 && value <= 65 && Math.abs(value - lugToLugMm) > 0.05);
      if (planar != null) caseValues.push(planar);
      if (values.length === 3 && values[2] < 25) thicknessValues.push(values[2]);
    } else if (values.length >= 2 && values[0] >= 25 && values[1] < 25) {
      // A common prose shorthand is "39mm x 13mm" for diameter by
      // thickness, with the lug-to-lug value stated elsewhere nearby.
      caseValues.push(values[0]);
      thicknessValues.push(values[1]);
    }
  }

  const casePatterns = [
    new RegExp(String.raw`\b${unit}\s+(?:wide|across|in\s+diameter|diameter|without\s+(?:the\s+)?crown|case\b)`, "giu"),
    new RegExp(String.raw`\b(?:diameter|case\s+(?:diameter|width|size))\s*(?:of|is|at|measures?)?\s*${unit}\b`, "giu"),
    new RegExp(String.raw`\b(?:case|watch)\b[^.!?\n]{0,45}?\b(?:measures?|sized|comes\s+in\s+at)\s*${unit}\b`, "giu")
  ];
  for (const pattern of casePatterns) {
    for (const match of context.matchAll(pattern)) {
      const value = numeric(match[1]);
      if (value >= 15 && value <= 65) caseValues.push(value);
    }
  }

  if (!caseValues.some((value) => Math.abs(value - lugToLugMm) > 0.05)) {
    const allValues = [...context.matchAll(new RegExp(unit, "giu"))].map((match) => numeric(match[1]));
    const planar = allValues.find(
      (value) => value >= 25 && value <= 65 && Math.abs(value - lugToLugMm) > 0.05
    );
    if (planar != null) caseValues.push(planar);
  }

  const thicknessPatterns = [
    new RegExp(String.raw`\b${unit}\s*(?:in\s+)?(?:thick|thickness|profile)\b`, "giu"),
    new RegExp(String.raw`\b(?:thickness|profile)\s*(?:of|is|at|measures?)?\s*${unit}\b`, "giu")
  ];
  for (const pattern of thicknessPatterns) {
    for (const match of context.matchAll(pattern)) {
      const value = numeric(match[1]);
      if (value >= 2 && value <= 30) thicknessValues.push(value);
    }
  }

  const lugWidthPatterns = [
    new RegExp(String.raw`\b${unit}\s*(?:lug\s+width|between\s+the\s+lugs)\b`, "giu"),
    new RegExp(String.raw`\b(?:lug\s+width|between\s+the\s+lugs)\s*(?:of|is|at|measures?)?\s*${unit}\b`, "giu")
  ];
  for (const pattern of lugWidthPatterns) {
    for (const match of context.matchAll(pattern)) {
      const value = numeric(match[1]);
      if (value >= 8 && value <= 35) lugWidthValues.push(value);
    }
  }

  if (!caseValues.some((value) => Math.abs(value - lugToLugMm) > 0.05)) {
    const supplementalContext = candidate.contexts
      .filter((item) => item.signals.includes("direct-lug-to-lug"))
      .map((item) => item.context)
      .join("\n")
      .replace(/(?<=\d),(?=\d)/gu, ".");
    const supplementalPatterns = [
      new RegExp(
        String.raw`\b${unit}\s+(?:wide|across|in\s+diameter|diameter|without\s+(?:the\s+)?crown|proportions|stainless[- ]steel\s+watch)\b`,
        "giu"
      ),
      new RegExp(
        String.raw`\b(?:diameter|case\s+(?:diameter|width|size))\s*(?:of|is|at|measures?)?\s*(?:only|just|about|around|approximately)?\s*${unit}\b`,
        "giu"
      ),
      new RegExp(
        String.raw`\b(?:case\s+)?diameter\b[^.!?\n]{0,45}?\b(?:at|to\s+now|measuring|of|is)\s*${unit}\b`,
        "giu"
      ),
      new RegExp(String.raw`\bcase\s+of\s+${unit}\b`, "giu"),
      new RegExp(String.raw`\b${unit}\s+(?:[\p{L}\d-]+\s+){0,4}case\b`, "giu"),
      new RegExp(String.raw`\b${unit}\s+(?:in\s+width|edition|size)\b`, "giu"),
      new RegExp(String.raw`\bthe\s+${unit}\s+wears\b`, "giu"),
      new RegExp(String.raw`\b(?:is|as)\s+a\s+${unit}\s+(?:[\p{L}-]+\s+){0,3}watch\b`, "giu")
    ];
    for (const pattern of supplementalPatterns) {
      for (const match of supplementalContext.matchAll(pattern)) {
        const value = numeric(match[1]);
        if (value >= 15 && value <= 65 && Math.abs(value - lugToLugMm) > 0.05) caseValues.push(value);
      }
    }
    for (const match of supplementalContext.matchAll(pairPattern)) {
      const first = numeric(match[1]);
      const second = numeric(match[2]);
      const third = match[3] == null ? null : numeric(match[3]);
      if (first >= 25 && first <= 65 && second < 25 && (third == null || third < 25)) {
        caseValues.push(first);
        thicknessValues.push(second);
      }
    }
  }

  const titleCase = String(candidate.title).match(/\b(\d{2}(?:\.\d+)?)\s*mm\b/iu);
  if (titleCase) caseValues.push(Number(titleCase[1]));

  const plausibleCaseValues = unique(caseValues).filter(
    (value) =>
      value >= 15 &&
      value <= 65 &&
      (value > 25 || lugToLugMm <= 35) &&
      Math.abs(value - lugToLugMm) > 0.05
  );
  const plausibleTitleCase = titleCase == null ? null : Number(titleCase[1]);
  const caseMm =
    (plausibleCaseValues.includes(plausibleTitleCase) ? plausibleTitleCase : null) ??
    plausibleCaseValues.find((value) => value <= lugToLugMm + 1) ??
    plausibleCaseValues[0] ??
    null;
  const thicknessMm = unique(thicknessValues).find((value) => Math.abs(value - lugToLugMm) > 0.5) ?? null;
  const lugWidthMm = unique(lugWidthValues).find((value) => Math.abs(value - lugToLugMm) > 0.5) ?? null;
  return { caseMm, thicknessMm, lugWidthMm, caseCandidates: plausibleCaseValues };
}

function articleIdentityText(candidate) {
  return normalize(`${candidate.title} ${candidate.slug ?? ""}`);
}

const identityStopWords = new Set([
  "a",
  "all",
  "an",
  "and",
  "automatic",
  "collection",
  "edition",
  "for",
  "hands",
  "in",
  "introducing",
  "limited",
  "live",
  "mm",
  "new",
  "of",
  "on",
  "review",
  "the",
  "watch",
  "watches",
  "with"
]);

function identityTokens(value) {
  return normalize(value)
    .replace(/\bfifty\s+eight\b/gu, "58")
    .split(" ")
    .filter((token) => token.length >= 2 && !identityStopWords.has(token));
}

function existingTargets(candidate, brands, references, values = candidate.directLugToLugValues) {
  const title = ` ${normalize(candidate.title)} `;
  const referenceKeys = references.map(compact);

  const eligibleWatches = brandWatches(brands);
  const referenceTargets = eligibleWatches.filter((watch) => {
    if (brands.length && !brands.some((brand) => brandRelated(watch.brand, brand))) return false;
    const key = compact(watch.reference);
    return key.length >= 4 && /\d/u.test(key) && referenceKeys.includes(key);
  });
  if (referenceTargets.length) {
    if (referenceTargets.length > 1) {
      const directContext = compact(
        candidate.contexts.flatMap((context) => context.directLugToLugMentions ?? []).map((mention) => mention.context).join(" ")
      );
      const contextualTargets = referenceTargets.filter((watch) => {
        const key = compact(watch.reference);
        return key.length >= 4 && directContext.includes(key);
      });
      if (contextualTargets.length) return contextualTargets;

      const metricTargets = referenceTargets.filter((watch) =>
        values.some((value) => sameMetric(watch.lugToLugMm, value))
      );
      if (metricTargets.length) return metricTargets;
    }
    return unique(referenceTargets.map((watch) => watch.id)).map((id) => watches.find((watch) => watch.id === id));
  }

  const exactModelTargets = eligibleWatches.filter((watch) => {
    if (brands.length && !brands.some((brand) => brandRelated(watch.brand, brand))) return false;
    const model = normalize(watch.model);
    if (model.length < 6 || !title.includes(` ${model} `)) return false;
    return values.some((value) => sameMetric(watch.lugToLugMm, value));
  });
  if (exactModelTargets.length) return exactModelTargets;

  const titleTokens = new Set(identityTokens(candidate.title));
  const scored = eligibleWatches
    .filter((watch) =>
      addedThisRunIds.has(watch.id) ||
      watch.sources.some((source) => !String(source.note ?? "").startsWith("MONOCHROME reports "))
    )
    .filter((watch) => values.some((value) => sameMetric(watch.lugToLugMm, value)))
    .map((watch) => {
      const modelTokens = unique(identityTokens(watch.model));
      const matches = modelTokens.filter((token) => titleTokens.has(token));
      const coverage = modelTokens.length ? matches.length / modelTokens.length : 0;
      return { watch, score: matches.length, coverage };
    })
    .filter(({ score, coverage }) => score >= 2 && coverage >= 0.5)
    .sort((left, right) => right.score - left.score || right.coverage - left.coverage || left.watch.id - right.watch.id);
  if (!scored.length) return [];
  const bestScore = scored[0].score;
  const bestCoverage = scored[0].coverage;
  return scored
    .filter(({ score, coverage }) => score === bestScore && coverage >= bestCoverage - 0.01)
    .map(({ watch }) => watch);
}

function sourceNote(record, candidate, { retainedValue } = {}) {
  const metrics = [
    `${record.approximate ? "approximately " : ""}${record.lugToLugMm}mm lug-to-lug`,
    record.caseMm == null ? null : `${record.caseMm}mm case size/width`,
    record.thicknessMm == null ? null : `${record.thicknessMm}mm thickness`,
    record.lugWidthMm == null ? null : `${record.lugWidthMm}mm lug width`
  ].filter(Boolean);
  const retained = retainedValue == null ? "" : ` The seed retains its existing ${retainedValue}mm value pending conflict resolution.`;
  const semantic = record.semantic
    ? " The article's explicit planar case length/top-to-bottom dimension is stored as the lug-to-lug equivalent."
    : "";
  return `MONOCHROME reports ${metrics.join(", ")} for ${record.brand} ${record.model} in “${candidate.title}.”${semantic}${retained}`;
}

function semanticMeasurements(candidate) {
  const measurements = [];
  const unitSource = String.raw`(\d{1,2}(?:[.,]\d+)?)\s*(?:mm|millimet(?:er|re)s?)`;

  function pushMeasurement(raw) {
    const measurement = {
      ...raw,
      lugToLugMm: numeric(raw.lugToLugMm),
      caseMm: raw.caseMm == null ? null : numeric(raw.caseMm)
    };
    if (measurement.lugToLugMm < 25 || measurement.lugToLugMm > 75) return;
    if (measurement.caseMm != null && (measurement.caseMm < 15 || measurement.caseMm > 65)) return;
    const key = `${measurement.lugToLugMm}|${measurement.caseMm}|${measurement.method}`;
    if (!measurements.some((item) => item.key === key)) measurements.push({ key, ...measurement });
  }

  for (const item of candidate.contexts.filter(
    (context) => context.signals.includes("semantic-case-length") || context.signals.includes("dimension-pair")
  )) {
    for (const originalSentence of item.context.split(/(?<=[.!?])\s+(?=[A-Z0-9])/u)) {
      let sentence = originalSentence.replace(/(?<=\d),(?=\d)/gu, ".");
      sentence = sentence.split(/\b(?:Movement|Calib(?:re|er)|Bracelet|Strap)\s*:/iu, 1)[0];
      if (!/(?:case|watch|dimensions?|top\s+to\s+bottom|12\s+to\s+6|long\s+axis)/iu.test(sentence)) continue;
      if (/\b(?:bracelet|strap|chain|hand|index(?:es)?|dial)\b[^.!?]{0,30}\b(?:length|long)\b/iu.test(sentence)) continue;

      const topBottomBefore = sentence.match(
        new RegExp(String.raw`\b${unitSource}\s*(?:from\s+)?(?:top\s+to\s+bottom|12\s*(?:to|[-\u2010-\u2015])\s*6)\b`, "iu")
      );
      const topBottomAfter = sentence.match(
        new RegExp(String.raw`\b(?:top\s+to\s+bottom|12\s*(?:to|[-\u2010-\u2015])\s*6)[^.!?]{0,35}?${unitSource}\b`, "iu")
      );
      const topBottom = topBottomBefore ?? topBottomAfter;
      if (topBottom) {
        const lugToLugMm = numeric(topBottom[1]);
        const wide = sentence.match(
          new RegExp(String.raw`\b${unitSource}\s*(?:wide|across|from\s+left\s+to\s+right)\b`, "iu")
        );
        const otherPlanar = [...sentence.matchAll(new RegExp(unitSource, "giu"))]
          .map((match) => numeric(match[1]))
          .find((value) => value >= 25 && Math.abs(value - lugToLugMm) > 0.05);
        pushMeasurement({
          lugToLugMm,
          caseMm: wide ? numeric(wide[1]) : otherPlanar ?? null,
          method: "top-to-bottom",
          context: originalSentence.slice(0, 2_000),
          approximate: /\b(?:about|around|approximately|roughly)\b/iu.test(sentence)
        });
        continue;
      }

      const widthLength = sentence.match(
        new RegExp(
          String.raw`\b(?:width|wide)\s*(?:of|is|at|:)?\s*${unitSource}[^.!?]{0,60}?\b(?:length|long)\s*(?:of|is|at|:)?\s*${unitSource}\b`,
          "iu"
        )
      );
      if (widthLength) {
        pushMeasurement({
          lugToLugMm: widthLength[2],
          caseMm: widthLength[1],
          method: "labeled-case-length",
          context: originalSentence.slice(0, 2_000),
          approximate: /\b(?:about|around|approximately|roughly)\b/iu.test(sentence)
        });
        continue;
      }

      const lengthPatterns = [
        new RegExp(String.raw`\b(?:overall|total|case|watch|vertical)[^.!?]{0,35}?\b(?:length|long\s+axis)\s*(?:of|is|at|:|measures?)?\s*${unitSource}\b`, "iu"),
        new RegExp(String.raw`\b(?:length|long\s+axis)\s*(?:of\s+(?:the\s+)?(?:case|watch)\s*)?(?:of|is|at|:|measures?)?\s*${unitSource}\b`, "iu"),
        new RegExp(String.raw`\b(?:case|watch)\b[^.!?]{0,45}\b${unitSource}\s+(?:long|tall)\b`, "iu"),
        new RegExp(String.raw`\b${unitSource}\s+(?:in\s+)?(?:overall\s+)?(?:case\s+)?length\b`, "iu"),
        new RegExp(String.raw`\b${unitSource}\s+(?:long|tall)\s+(?:case|watch)\b`, "iu"),
        new RegExp(String.raw`\b${unitSource}\s+(?:long|tall)\b[^.!?]{0,45}\b(?:case|watch)\b`, "iu")
      ];
      let lengthMatch = null;
      for (const pattern of lengthPatterns) {
        lengthMatch = sentence.match(pattern);
        if (lengthMatch) break;
      }
      if (lengthMatch) {
        const lugToLugMm = numeric(lengthMatch[1]);
        const wide = sentence.match(
          new RegExp(String.raw`\b${unitSource}\s*(?:wide|across|from\s+left\s+to\s+right)\b`, "iu")
        );
        const otherPlanar = [...sentence.matchAll(new RegExp(unitSource, "giu"))]
          .map((match) => numeric(match[1]))
          .find((value) => value >= 25 && Math.abs(value - lugToLugMm) > 0.05);
        pushMeasurement({
          lugToLugMm,
          caseMm: wide ? numeric(wide[1]) : otherPlanar ?? null,
          method: "explicit-case-length",
          context: originalSentence.slice(0, 2_000),
          approximate: /\b(?:about|around|approximately|roughly)\b/iu.test(sentence)
        });
        continue;
      }

      const pairPattern = new RegExp(
        String.raw`\b${unitSource}\s*(?:[x\u00d7]|by)\s*${unitSource}(?:\s*(?:[x\u00d7]|by)\s*${unitSource})?\b`,
        "giu"
      );
      for (const match of sentence.matchAll(pairPattern)) {
        const first = numeric(match[1]);
        const second = numeric(match[2]);
        const third = match[3] == null ? null : numeric(match[3]);
        if (first < 25 || second < 25 || (third != null && third >= 25)) continue;
        if (!/\b(?:case|watch|dimensions?|measures?|sized)\b/iu.test(sentence)) continue;
        pushMeasurement({
          lugToLugMm: Math.max(first, second),
          caseMm: Math.min(first, second),
          method: "planar-dimension-pair",
          context: originalSentence.slice(0, 2_000),
          approximate: /\b(?:about|around|approximately|roughly)\b/iu.test(sentence)
        });
      }
    }
  }

  return measurements.map(({ key: _key, ...measurement }) => measurement);
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  siteArticleCount: summary.sitemapArticleCount,
  completedArticleCount: summary.completedArticleCount,
  failureCount: summary.failureCount,
  candidateCount: summary.candidateCount,
  directCandidateCount: summary.directCandidateCount,
  directNumericArticleCount: 0,
  directQualitativeArticleCount: 0,
  directCoveredArticleCount: 0,
  indirectExtractedArticleCount: 0,
  indirectCoveredArticleCount: 0,
  indirectAddedCount: 0,
  indirectAugmentedCount: 0,
  indirectExclusionCount: 0,
  indirectAdded: [],
  indirectAugmented: [],
  indirectExclusions: [],
  added: [],
  augmented: [],
  conflicts: [],
  exclusions: []
};

function appendSource(watch, record, candidate, retainedValue = null) {
  if (sourceAlreadyPresent(watch, candidate.url)) return false;
  watch.sources.push({ sourceUrl: candidate.url, note: sourceNote(record, candidate, { retainedValue }) });
  const item = { id: watch.id, brand: watch.brand, model: watch.model, reference: watch.reference, url: candidate.url };
  report.augmented.push(item);
  if (record.semantic) report.indirectAugmented.push(item);
  return true;
}

function addRecord(record, candidate) {
  const exactReferenceMatches = watches.filter(
    (watch) => brandRelated(watch.brand, record.brand) && compact(watch.reference) === compact(record.reference)
  );
  if (exactReferenceMatches.length) {
    for (const watch of exactReferenceMatches) {
      if (sourceAlreadyPresent(watch, candidate.url)) continue;
      const agrees = sameMetric(watch.lugToLugMm, record.lugToLugMm) && sameMetric(watch.caseMm, record.caseMm, 0.4);
      if (!agrees) {
        report.conflicts.push({
          id: watch.id,
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          seedLugToLugMm: watch.lugToLugMm,
          monochromeLugToLugMm: record.lugToLugMm,
          seedCaseMm: watch.caseMm,
          monochromeCaseMm: record.caseMm,
          url: candidate.url,
          semantic: record.semantic || undefined
        });
      }
      appendSource(watch, record, candidate, agrees ? null : watch.lugToLugMm);
    }
    return;
  }

  const fallbackMatch = watches.find(
    (watch) =>
      brandRelated(watch.brand, record.brand) &&
      normalize(watch.model) === normalize(record.model) &&
      sameMetric(watch.lugToLugMm, record.lugToLugMm) &&
      sameMetric(watch.caseMm, record.caseMm, 0.4)
  );
  if (fallbackMatch) {
    appendSource(fallbackMatch, record, candidate);
    return;
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
  addedThisRunIds.add(watch.id);
  const indexedBrandWatches = watchesByBrandKey.get(brandKey(watch.brand)) ?? [];
  indexedBrandWatches.push(watch);
  watchesByBrandKey.set(brandKey(watch.brand), indexedBrandWatches);
  const addedItem = {
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    reference: watch.reference,
    lugToLugMm: watch.lugToLugMm,
    caseMm: watch.caseMm,
    thicknessMm: watch.thicknessMm,
    lugWidthMm: watch.lugWidthMm,
    url: candidate.url
  };
  report.added.push(addedItem);
  if (record.semantic) report.indirectAdded.push(addedItem);
}

function exclusion(candidate, reason, detail = null) {
  report.exclusions.push({ url: candidate.url, title: candidate.title, reason, detail });
}

function augmentTargets(candidate, values, targets) {
  for (const watch of targets) {
    if (sourceAlreadyPresent(watch, candidate.url)) continue;
    const nearestValue = values.reduce((best, value) =>
      Math.abs(value - Number(watch.lugToLugMm)) < Math.abs(best - Number(watch.lugToLugMm)) ? value : best
    );
    const metrics = extractedMetrics(candidate, nearestValue);
    const record = {
      brand: watch.brand,
      model: watch.model,
      reference: watch.reference,
      lugToLugMm: nearestValue,
      caseMm: metrics.caseMm ?? watch.caseMm,
      thicknessMm: metrics.thicknessMm,
      lugWidthMm: metrics.lugWidthMm,
      approximate: false
    };
    const agrees = sameMetric(watch.lugToLugMm, nearestValue);
    if (!agrees) {
      report.conflicts.push({
        id: watch.id,
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        seedLugToLugMm: watch.lugToLugMm,
        monochromeLugToLugMm: nearestValue,
        seedCaseMm: watch.caseMm,
        monochromeCaseMm: record.caseMm,
        url: candidate.url
      });
    }
    appendSource(watch, record, candidate, agrees ? null : watch.lugToLugMm);
  }
}

let processedDirect = 0;
const pendingMissingCaseCandidates = [];
for (const candidate of summary.candidates) {
  if (!candidate.signals.includes("direct-lug-to-lug")) continue;
  processedDirect += 1;
  if (processedDirect % 100 === 0) process.stdout.write(`Prepared ${processedDirect}/${summary.directCandidateCount} direct candidates.\n`);
  const values = candidate.directLugToLugValues;
  if (!values.length) {
    report.directQualitativeArticleCount += 1;
    if (!sourceUrlsAtStart.has(normalizedUrl(candidate.url))) {
      exclusion(candidate, "qualitative-or-no-direct-number");
    }
    continue;
  }
  report.directNumericArticleCount += 1;
  if (sourceUrlsAtStart.has(normalizedUrl(candidate.url))) continue;

  const brands = candidateBrands(candidate);
  const references = articleReferences(candidate).filter(
    (reference) => !brands.some((brand) => brandRelated(reference, brand))
  );
  const targets = existingTargets(candidate, brands, references);
  if (targets.length) {
    augmentTargets(candidate, values, targets);
    continue;
  }

  if (values.length !== 1) {
    exclusion(candidate, "multiple-direct-values-require-identity-mapping", values);
    continue;
  }
  if (brands.length !== 1) {
    exclusion(candidate, "missing-or-multiple-brand-categories", brands);
    continue;
  }

  const brand = brands[0];
  if (!compact(articleIdentityText(candidate)).includes(brandKey(brand))) {
    exclusion(candidate, "brand-category-not-present-in-article-identity", brand);
    continue;
  }
  const lugToLugMm = values[0];
  const metrics = extractedMetrics(candidate, lugToLugMm);
  if (metrics.caseMm == null) {
    pendingMissingCaseCandidates.push({ candidate, values, brands, references, metrics });
    continue;
  }
  if (lugToLugMm < 25 && metrics.caseMm > lugToLugMm + 1) {
    exclusion(candidate, "implausible-lug-to-lug-vs-case", {
      lugToLugMm,
      caseMm: metrics.caseMm
    });
    continue;
  }

  const model = cleanModelTitle(candidate.title, brand);
  if (!model || model.length < 3) {
    exclusion(candidate, "missing-model-identity");
    continue;
  }
  if (
    /\b(?:buying guide|best\s+\d+|compared|comparison|versus|\bvs\.?\b|battle|history\s+of|finalists?|jury|predictions?|interview|all\s+the|all\s+\d+|two\s+new|\d+\s+(?:great|cool|best|new)\s+(?:models|watches))\b/iu.test(
      candidate.title
    )
  ) {
    exclusion(candidate, "multi-watch-editorial-requires-review");
    continue;
  }

  const recordReferences = references.length ? references : [model];
  if (recordReferences.length > 6) {
    exclusion(candidate, "too-many-reference-identities", recordReferences);
    continue;
  }

  for (const reference of recordReferences) {
    addRecord(
      {
        brand,
        model,
        reference,
        lugToLugMm,
        caseMm: metrics.caseMm,
        thicknessMm: metrics.thicknessMm,
        lugWidthMm: metrics.lugWidthMm,
        approximate: /\b(?:about|around|approximately|roughly|just\s+(?:over|under)|claimed)\b/iu.test(
          metricContext(candidate)
        )
      },
      candidate
    );
  }
}

// A later article can establish a safely identified record for an earlier
// article that stated only the lug-to-lug size. Give those deferred articles
// one more identity-matching pass before leaving them for manual review.
for (const pending of pendingMissingCaseCandidates) {
  const { candidate, values, brands, references, metrics } = pending;
  const targets = existingTargets(candidate, brands, references, values);
  if (targets.length) {
    augmentTargets(candidate, values, targets);
  } else {
    exclusion(candidate, "missing-case-size", {
      lugToLugMm: values[0],
      caseCandidates: metrics.caseCandidates
    });
  }
}

const indirectExtractedUrls = new Set();
for (const candidate of summary.candidates) {
  if (candidate.signals.includes("direct-lug-to-lug")) continue;
  const measurements = semanticMeasurements(candidate);
  if (!measurements.length) continue;
  report.indirectExtractedArticleCount += 1;
  indirectExtractedUrls.add(normalizedUrl(candidate.url));
  if (sourceUrlsAtStart.has(normalizedUrl(candidate.url))) continue;

  const values = unique(measurements.map((measurement) => measurement.lugToLugMm));
  const brands = candidateBrands(candidate);
  const references = articleReferences(candidate).filter(
    (reference) => !brands.some((brand) => brandRelated(reference, brand))
  );
  const targets = existingTargets(candidate, brands, references, values);
  if (targets.length) {
    for (const watch of targets) {
      if (sourceAlreadyPresent(watch, candidate.url)) continue;
      const measurement = measurements.reduce((best, item) =>
        Math.abs(item.lugToLugMm - Number(watch.lugToLugMm)) <
        Math.abs(best.lugToLugMm - Number(watch.lugToLugMm))
          ? item
          : best
      );
      const record = {
        brand: watch.brand,
        model: watch.model,
        reference: watch.reference,
        lugToLugMm: measurement.lugToLugMm,
        caseMm: measurement.caseMm ?? watch.caseMm,
        thicknessMm: null,
        lugWidthMm: null,
        approximate: measurement.approximate,
        semantic: true
      };
      const agrees = sameMetric(watch.lugToLugMm, measurement.lugToLugMm);
      if (!agrees) {
        report.conflicts.push({
          id: watch.id,
          brand: watch.brand,
          model: watch.model,
          reference: watch.reference,
          seedLugToLugMm: watch.lugToLugMm,
          monochromeLugToLugMm: measurement.lugToLugMm,
          seedCaseMm: watch.caseMm,
          monochromeCaseMm: record.caseMm,
          url: candidate.url,
          semantic: true
        });
      }
      appendSource(watch, record, candidate, agrees ? null : watch.lugToLugMm);
    }
    continue;
  }

  function indirectExclusion(reason, detail = null) {
    report.indirectExclusions.push({ url: candidate.url, title: candidate.title, reason, detail });
  }

  if (values.length !== 1) {
    indirectExclusion("multiple-planar-values-require-identity-mapping", values);
    continue;
  }
  if (brands.length !== 1) {
    indirectExclusion("missing-or-multiple-brand-categories", brands);
    continue;
  }

  const brand = brands[0];
  if (!compact(articleIdentityText(candidate)).includes(brandKey(brand))) {
    indirectExclusion("brand-category-not-present-in-article-identity", brand);
    continue;
  }
  if (
    /\b(?:buying guide|best\s+\d+|compared|comparison|versus|\bvs\.?\b|battle|history\s+of|finalists?|jury|predictions?|interview|all\s+the|all\s+\d+|two\s+new|several\s+new|\d+\s+(?:great|cool|best|new)\s+(?:models|watches))\b/iu.test(
      candidate.title
    )
  ) {
    indirectExclusion("multi-watch-editorial-requires-review");
    continue;
  }

  const measurement = measurements.find((item) => item.lugToLugMm === values[0]);
  if (measurement.caseMm == null) {
    indirectExclusion("missing-case-width", measurement);
    continue;
  }
  const model = cleanModelTitle(candidate.title, brand);
  if (!model || model.length < 3) {
    indirectExclusion("missing-model-identity");
    continue;
  }

  const recordReferences = references.length ? references : [model];
  if (recordReferences.length > 6) {
    indirectExclusion("too-many-reference-identities", recordReferences);
    continue;
  }
  for (const reference of recordReferences) {
    addRecord(
      {
        brand,
        model,
        reference,
        lugToLugMm: measurement.lugToLugMm,
        caseMm: measurement.caseMm,
        thicknessMm: null,
        lugWidthMm: null,
        approximate: measurement.approximate,
        semantic: true
      },
      candidate
    );
  }
}

report.addedCount = report.added.length;
report.augmentedCount = report.augmented.length;
report.conflictCount = report.conflicts.length;
report.exclusionCount = report.exclusions.length;
const finalSourceUrls = new Set(watches.flatMap((watch) => watch.sources.map((source) => normalizedUrl(source.sourceUrl))));
report.directCoveredArticleCount = new Set(
  summary.candidates
    .filter((candidate) => candidate.signals.includes("direct-lug-to-lug") && finalSourceUrls.has(normalizedUrl(candidate.url)))
    .map((candidate) => normalizedUrl(candidate.url))
).size;
report.indirectCoveredArticleCount = new Set(
  [...indirectExtractedUrls].filter((url) => finalSourceUrls.has(url))
).size;
report.indirectAddedCount = report.indirectAdded.length;
report.indirectAugmentedCount = report.indirectAugmented.length;
report.indirectExclusionCount = report.indirectExclusions.length;
report.finalWatchCount = watches.length;

if (apply) await writeFile(seedPath, `${JSON.stringify(watches, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `MONOCHROME import ${apply ? "applied" : "previewed"}: ${report.addedCount} added, ` +
    `${report.augmentedCount} augmented, ${report.conflictCount} conflicts, ${report.exclusionCount} exclusions.\n`
);

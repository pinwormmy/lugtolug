# MONOCHROME lug-to-lug import report

Generated on 2026-08-08 from the public WordPress REST API at
`https://monochrome-watches.com/wp-json/wp/v2/posts`.

## Coverage

| Metric | Result |
| --- | ---: |
| Articles reported by the API | 12,366 |
| Articles audited successfully | 12,366 |
| Failed article/page requests | 0 |
| Broad lug/dimension candidates | 6,589 |
| Articles with direct `lug-to-lug`/`L2L` language | 963 |
| Direct articles with a parsed number | 903 |
| Direct articles represented by a final seed source | 815 (84.6%) |
| Articles with an extractable explicit planar case length | 740 |
| Planar-length articles represented by a final seed source | 586 (79.2%) |

The importer added 551 watch records and 1,679 MONOCHROME source links. The
seed grew from 6,910 to 7,461 watch records. A second preview against the
result produced zero additions, zero source augmentations, and zero conflicts.

## Interpretation rules

- Direct forms include `lug-to-lug`, typographic dash/space variants, `lug to lug`, and `L2L`.
- British and American millimetre spellings and decimal commas are normalized.
- Nearby diameter, thickness, lug-width, strap-attachment, and comparison values are excluded from a direct lug-to-lug measurement.
- `height` is accepted as a lug-to-lug equivalent only when the article explicitly describes planar case length, top-to-bottom/12-to-6 size, or an unambiguous two-dimensional case measurement. Generic height is treated as thickness and is not imported.
- Multi-watch articles are attached automatically only when a reference/model can be mapped without ambiguity.
- Existing seed dimensions are never overwritten by a conflicting MONOCHROME value. The source and conflict note are retained for review.

## Uncovered direct articles

The 148 direct articles without a final source association remain excluded for
the following reasons:

| Reason | Articles |
| --- | ---: |
| Qualitative statement or no direct number | 59 |
| Missing or multiple brand categories | 30 |
| Multiple direct values requiring model-by-model mapping | 26 |
| Brand category absent from article identity | 22 |
| Multi-watch editorial requiring review | 7 |
| Missing case size needed for a new record | 3 |
| Implausible direct value versus case size | 1 |

The 154 uncovered explicit planar-length articles consist of 94 with missing
or multiple brand categories, 40 with multiple planar values, 9 whose brand
category is absent from the article identity, 7 without a case width, and 4
multi-watch editorials.

## Retained conflicts

The following 13 source conflicts retain the seed value and add the
MONOCHROME claim as a source note:

| Watch | Seed | MONOCHROME | Source type |
| --- | ---: | ---: | --- |
| Grand Seiko SBGM221 | 46.9mm | 46mm | direct |
| Seiko SPB153 | 46mm | 46.6mm | direct |
| Seiko SRQ043 | 50mm | 45.5mm | direct |
| Grand Seiko SBGR325 | 44.6mm | 46.6mm | direct |
| Doxa 200T | 45mm | 41.5mm | direct |
| MCT D110 | 42mm | 43mm | planar length |
| Gerald Charles Maestro 8.0 Squelette | 46mm | 41mm | planar length |
| Urwerk UR-120 | 47mm | 44mm | planar length |
| Urwerk UR-100V | 49.7mm | 51.63mm | planar length |
| Bianchet B1.618 | 50mm | 51mm | planar length |
| Otsuka Lotec No. 9 | 41.3mm | 48mm | planar length |
| Horologically Unique HU-01 | 44mm | 41mm | planar length |
| Urwerk UR-100V | 49.7mm | 51.7mm | planar length |

## Reproduction

```sh
npm run data:audit:monochrome
npm run data:summarize:monochrome
npm run data:import:monochrome
npm run data:import:monochrome -- --apply
npm run data:seed-sql
```

The audit and summary artifacts default to `/private/tmp` because the full-text
audit is large. The compact seed, generated SQL, importer, and this report are
versioned in the repository.

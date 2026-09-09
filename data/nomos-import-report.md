# NOMOS official catalog import report

## Full-catalog sweep (2026-09-09)

Audited the official NOMOS Glashütte international English store at `nomos-glashuette.com/en/store/watches` and imported every product page that publishes a lug-to-lug value. The importer is `scripts/import-nomos.mjs` (`npm run data:import:nomos`, `--write` to apply).

Coverage and results:

- The store listing declared **165 products** ("165 results"); catalog discovery found **165 product tiles**, matching the declared count. Each tile names one or two references (the primary SKU and, where the watch is also sold with the other case back, the alternate SKU), **253 declared references** in total.
- The case-back selector on each product page links the sibling reference, which yielded **253 URLs**: 165 tile URLs, 87 sibling URLs and 1 probed URL (below).
- **252/252 product pages fetched and parsed successfully**, with no request failures, no parsing failures, no in-page value conflicts and no invalid dimensions. Every page publishes diameter (or width × height), height and lug-to-lug.
- **252 unique official references** were imported: **173 new records** (ids 7568–7740, appended in catalog order) and **79 existing NOMOS records updated** with the official dimensions and product URL.
- 33 of the 252 pages describe rectangular cases (Tetra, Lux); the rest are round.
- The import covers **192 official product names** and **77 distinct dimension sets**; published lug-to-lug values range from **38.5 mm to 52.6 mm**.
- NOMOS now holds 295 records (123 before): 253 cite an official product page (10 before), 261 have a thickness (35 before) and 276 have a lug width (111 before).

Declared reference without a product page (not imported, no value inferred):

- `560.SB` (Ahoi neomatik, stainless steel back) is listed as the alternate SKU of the `Ahoi neomatik` tile, but the `560` page has no case-back selector and `nomos-glashuette.com/en/ahoi/ahoi-neomatik-560.sb` returns HTTP 404. The importer probes that conventional URL, records the 404 and does not treat it as a crawl failure.

Official pages without a lug width (imported with `lugWidthMm: null` unless an existing record already had one):

- `714`, `714.GB`, `715`, `715.GB` (Club Campus cream coral / Club Campus 36 pages), `790.S1`–`790.S9` (Club Sport neomatik Worldtimer editions) and `1180` (Metro rose gold neomatik 39). Existing records `790.S4` (id 4626, 20 mm from Delugs), `1180` (id 4685, 19 mm from Delugs) and `714` (id 1592, 18 mm from Teddy Baldassarre) kept their stored lug width; the 11 new records carry no lug width.

Existing records updated (79):

- 54 Delugs rows (ids 4626–4710) had no thickness; all now carry the official height. The three Hodinkee Tetra Origins rows (`438`, `439`, `440`) gained the official 18 mm lug width.
- 76 records gained the official `/en/` product URL as a new source in front of their existing sources; `101` (id 1251), `708` (id 1256) and `408` (id 1260) already cited that URL, so only their note was refreshed.
- Stored model names were not changed. 55 records differ from the official product name, 38 of them only in letter case (NOMOS writes descriptors in lower case: `Tangente 33 karat`). The wording differences are listed below for a separate decision, since renaming changes live URLs.

Official-source corrections applied (stored value differed from the official page):

| id | Ref. | Stored name | Correction |
| ---: | --- | --- | --- |
| 6569 | 140 | Tangente Neomatik 39 | lug-to-lug 48 → 47.3 mm |
| 1253 | 149 | Tangente neomatik 39 | thickness 7.2 → 6.9 mm |
| 4688 | 319 | Orion 33 Duo | lug-to-lug 42.3 → 41.3 mm (see the sibling disagreement below) |
| 1260 | 408 | Tetra | thickness 6.5 → 6.3 mm |
| 4682 | 807 | Zürich Zurich World Time | case 40 → 39.9 mm |
| 4629 | 701.1 | Club | lug-to-lug 47.5 → 44.3 mm |
| 4628 | 717 | Club Campus Endless Blue | lug-to-lug 47.5 → 44.3 mm |
| 1595 | 720 | Club Campus Steel Back 38.5mm - Rose on Leather Strap | lug-to-lug 48.9 → 46.7 mm |
| 4636 | 722 | Club Campus 38 Night Sky | lug-to-lug 48.9 → 46.7 mm |
| 1591 | 721.GB | Club Campus "Starlight" Sapphire Back 38mm - Yellow on Strap | lug-to-lug 48.9 → 46.7 mm |
| 4661 | 1106 | Metro Neomatik | lug-to-lug 40.9 → 42.1 mm |

The Club 36 pages `701.1`, `703.1`, `706`, `708`, `709` and `717` publish 44.3 mm where Delugs had 47.5 mm; `714` and `715` publish 47.5 mm. Club Campus 38 pages publish either 46.7 mm (`720`, `720.GB`, `721.GB`, `722`, `736`, `738`, …) or 48.9 mm (`721`, `723`, `735`, …). Each record stores the value of its own page.

Official pages that disagree with their case-back sibling (same watch, other case back, identical case size; both values stored as published, none inferred):

| Model | Page A | Page B |
| --- | --- | --- |
| Club Campus 38 | `735` (stainless steel back) 48.9 mm | `737` (sapphire crystal glass back) 46.7 mm |
| Club Campus 38 electric green | `726` (stainless steel back) 48.9 mm | `726.GB` (sapphire crystal glass back) 46.7 mm |
| Club Campus 38 starlight | `721` (stainless steel back) 48.9 mm | `721.GB` (sapphire crystal glass back) 46.7 mm |
| Club Campus deep pink | `711` (stainless steel back) 44.3 mm | `711.GB` (sapphire crystal glass back) 47.5 mm |
| Orion 33 duo doré | `319` (stainless steel back) 41.3 mm | `320` (sapphire crystal glass back) 42.3 mm |

The other 82 sibling pairs agree. The importer prints these pairs as `siblingDisagreements`; they are a question for NOMOS's product data, not a parsing error, so they do not block the import.

Duplicate retired:

- id 6410 `Tangente 2date` (Hodinkee, generic reference, 37.5 × 47.7 mm, 6.8 mm) duplicated the new official `135` record (id 7585, same dimensions). `scripts/audit-seed-data.mjs` flags a generic reference that shadows a numbered watch with the same name and dimensions, so the Hodinkee source was moved to id 7585 and 6410 was removed from the seed and added to `D1_ARCHIVED_WATCH_IDS`.

Existing NOMOS records with no reference in the current catalog (unchanged, 44):

- Official but no longer listed: `175` Tangente neomatik (id 1252).
- Delugs references not in the current store: `125`, `141`, `160.S1`, `205.S4`, `234.S4`, `243.S4`, `250`, `251.S4`, `260`, `283`, `321`, `352`, `363`, `383`, `393`, `421`, `602`, `641`, `712`, `729`, `775`, `802`, `806`, `952`, `1103`, `1203`, `1205`, `1301`, `1302`.
- Editorial rows whose reference is the article name: ids 2676, 2696, 2764, 2894, 2905, 2912, 5058, 6551, 7045, 7274, 7350, 7368, 7399. None shares an official product name and case/lug-to-lug pair, so the audit accepts them; they are candidates for a later reference clean-up.

Official names that differ from the stored name in wording (not applied):

| id | Ref. | Stored | Official |
| ---: | --- | --- | --- |
| 4666 | 120 | Tangente 33 Duo | Tangente 33 duo doré |
| 4687 | 240 | Ludwig 33 Duo | Ludwig 33 duo doré |
| 4688 | 319 | Orion 33 Duo | Orion 33 duo doré |
| 4663 | 405 | Tetra 27 Duo | Tetra 27 duo doré |
| 1602 | 437 | Tetra Ochra Sapphire Back 29.5mm - Ocher Yellow on Strap | Tetra Ochra |
| 4660 | 474 | Tetra - Die Kapriziöse | Tetra – Die Kapriziöse |
| 4640 | 805 | Zürich World Time | Zürich Worldtimer |
| 4682 | 807 | Zürich Zurich World Time | Zürich Worldtimer midnight blue |
| 1592 | 714 | Club Campus 36mm - Cream Coral on Leather Strap | Club Campus cream coral |
| 1596 | 750 | Club Sport Neomatik 37mm - Polar Blue on Bracelet | Club Sport neomatik polar |
| 1595 | 720 | Club Campus Steel Back 38.5mm - Rose on Leather Strap | Club Campus 38 full rose |
| 1594 | 720.GB | Club Campus Glass Back 38.5mm - Rose on Leather Strap | Club Campus 38 full rose |
| 1593 | 723 | Club Campus 38mm - Nonstop Red on Strap | Club Campus 38 nonstop red |
| 1591 | 721.GB | Club Campus "Starlight" Sapphire Back 38mm - Yellow on Strap | Club Campus 38 starlight |
| 1598 | 1250 | Minimatik Date 39mm - White Silver-Plated on Leather Strap | Minimatik 39 date |
| 1597 | 1252 | Minimatik Date 39mm - Blue on Leather Strap | Minimatik 39 date blue |
| 1599 | 1251 | Minimatik Date Gold Hands 39mm - White Silver-Plated on Leather Strap | Minimatik 39 date gold |

## Interpretation rules

- **Reference**: the `Ref.` value in the specification header, cross-checked against the URL slug (which ends in the reference, e.g. `tangente-2date-135.sb`) and the `Article number` in the product-safety popup. Sibling case-back references (`135` / `135.SB`, `101` / `139`, `401` / `401.GB`, `211.GOB`) are separate official pages and separate records.
- **Model**: the page `<h1>` product name (`Tangente 2date`), shared by both case-back references of a watch. No grouping metadata (`canonicalModel` / `modelGroup` / `variant`) was added.
- **caseMm**: `diameter` for round cases. Rectangular cases publish `size 34.0 mm × 38.5 mm`; the first value (the case width) is stored and the second is not, and the source note says so.
- **thicknessMm**: `height` from the Dimensions block (never the caliber's `movement height`).
- **lugToLugMm**: `lug-to-lug` from the Dimensions block.
- **lugWidthMm**: `lug width` from the strap/bracelet block; `null` when absent.
- **Source note**: quotes the values as printed on the page and the case-back type (`stainless steel back`, `sapphire crystal glass back`, `gold back`).
- **Existing records**: matched on brand `NOMOS` + compact reference. Official values replace stored values; a stored value is kept when the page publishes none; the display name and existing sources are kept; the official URL is added in front.
- **Refusals**: the importer previews only unless `--write` (or `--apply`) is given, and refuses to write when the tile count differs from the declared count, any page fails to load or parse, a linked page returns 404, a declared reference is neither parsed nor confirmed as 404, a parsed reference is not in the listing, a reference appears on two pages, or a page publishes invalid dimensions (non-positive, over the audit limits, or lug-to-lug below the case size). Pages without lug-to-lug or with conflicting values are excluded and listed, not written.

## Reproduction

```sh
npm run data:import:nomos            # preview; fetches one page at a time (750 ms apart) into /private/tmp/nomos-official-catalog
npm run data:import:nomos -- --write # apply
npm run data:seed-sql && npm run data:audit && npm test
```

Pass `--refresh` to ignore the page cache, or set `NOMOS_CACHE_DIR` to cache elsewhere. The 6410 retirement was a one-off edit (seed record removed, source moved to 7585, id added to `D1_ARCHIVED_WATCH_IDS` in `scripts/lib/seed-sql.mjs`) and is covered by `src/lib/seedData.test.ts`.

## Production D1

```sh
npm run data:seed-delta-sql -- --base-ref=<commit before this import>
```

The generator writes a `retired-001.sql` chunk that archives id 6410, followed by the watch and source chunks; apply them in that order.

# Orient official catalog import report

## Full-catalog sweep (2026-09-09)

The planned source, `orientwatchusa.com`, could not be used: its Cloudflare edge answers every non-browser request with HTTP 403 "Sorry, you have been blocked" (WAF block, not a challenge), for the catalog, product pages and `robots.txt` alike, with curl's default User-Agent as well as the project's audit User-Agent. Working around a bot block was not an option, so the import reads two other official Epson sites instead:

- **orient-watch.com** (the manufacturer's global English site): every Orient and Orient Star product page publishes `Case Size (Width)`, `Case Size (Height)`, `Case Size (Thickness)` and `Strap Width`. The height cell is the page's `case_length_mm` field, the top-to-bottom case length.
- **orientwatch.co.uk** (Orient Watches UK official store): product pages publish `Width`, `Lug-to-lug`, `Thickness` and `Lug width` under an explicit label.

Every reference published by both sites was compared field by field. **Lug-to-lug agreed on all 134 references present on both sites**, which is the evidence for storing the global site's case height as lug-to-lug.

The importer is `scripts/import-orient.mjs` (`npm run data:import:orient`, `--write` to apply). It fetches one page at a time, 750 ms apart, and caches every page in `/private/tmp/orient-official-catalog`.

### Global site (orient-watch.com)

Product pages were enumerated three ways and merged by reference:

| Enumeration | Product URLs / references |
| --- | ---: |
| `sitemap.xml` | 388 |
| Site search index (the site's own search API, 548 English documents) | 416 |
| 49 collection line pages, linked from the 7 category pages and the sitemap | 441 |
| Union | 443 references |

- **441/441 reachable product pages fetched and parsed** (Orient 317, Orient Star 124) with no request or parsing failures. The product-finder widget on the official search pages declares 317 Orient and 125 Orient Star products; the Orient count matches exactly, one Orient Star product of the widget count has no English product page in any enumeration.
- Stale paths: when a reference is listed under an old collection path, that URL returns 404 and the current line page carries the working one; the importer tries the line-page URL first and records the 404s (2 URLs).
- 2 references appear only in the sitemap and return 404 everywhere (`RA-BB0005V`, `RA-AC0034Y`); they are reported as stale listings and not imported from the global site (`RA-AC0034Y` is sold by the UK store and was imported from there).
- 43 product pages publish no case dimensions at all: 39 old-style references (`AC00009W`, `AA02002D`, `AG02003W`, `NR1Q005W`, …) plus `RA-AG0001S`, `RA-AG0002S`, `RA-AG0003S` and `RA-AG0005L`; they were not imported from the global site. Four other old-style references (`AC00008W`, `AC00009N`, `AC08003A`, `AC08004D`) have dimension-less global pages but are sold by the UK store, which supplied their dimensions.

### UK store (orientwatch.co.uk)

- Orient listing: **8 declared pages, 8 crawled, 102 products**. Orient Star listing: **4 declared pages, 4 crawled, 49 products**.
- **151/151 product pages fetched and parsed** with no failures; every page publishes width, lug-to-lug, thickness and lug width.

### Combined result

- **411 references importable**: Orient 284, Orient Star 127. 134 are published by both sites, 262 only by the global site, 15 only by the UK store.
- **396 new records** (ids 7741–8136: Orient 272, Orient Star 124) and **15 existing records updated** with the official dimensions and product URLs.
- Published lug-to-lug values range from **35.4 mm to 55 mm**.
- Orient now holds 292 records (20 before), 286 of them with an official source; Orient Star holds 129 records (5 before), 127 with an official source.

Cross-source disagreements (both values are official; the disputed value is not stored and both notes say so):

| Reference | Field | orient-watch.com | orientwatch.co.uk | Handling |
| --- | --- | ---: | ---: | --- |
| `RA-AC0023E`, `RA-AC0024L`, `RA-AC0025N`, `RA-AC0026R`, `RA-AC0027S`, `RA-AC0028S`, `RA-AC0029E`, `RA-AC0030L`, `RA-AC0031S`, `RA-AC0032V`, `RA-AC0033Y` (Bambino 40.5mm) | thickness | 12.3 mm | 12.0 mm | imported without thickness |
| `RA-AC0R01S`, `RA-AC0R02L`, `RA-AC0R03Y`, `RA-AC0R04N`, `RA-AC0R05E`, `RA-AC0R06L`, `RA-AC0R07P`, `RA-AC0R08Y`, `RA-AC0R09L` (Stretto Date) | thickness | 11.2 mm | 11.1 mm | imported without thickness |
| `RA-AR0011S` (Stretto 75th Anniversary Peanuts) | lug width | 22 mm | 20 mm | imported without lug width |
| `RE-AV0A02S`, `RE-AV0A03B` (Orient Star Avant-garde Skeleton) | case width, thickness | 42.6 mm, 13.0 mm | 43.2 mm, 13.7 mm | excluded (case size disputed) |

Existing records updated (15). Existing names and sources were kept; official URLs were added in front:

| id | Stored reference | Official reference | Stored name | Correction |
| ---: | --- | --- | --- | --- |
| 19 | FAC00009N0 | AC00009N | Bambino Version 2 | lug-to-lug 46.8 → 46.5 mm, thickness 11.8 → 12.5 mm (UK store; the global page has no dimensions) |
| 6351 | FAC00008W0 | AC00008W | Bambino Version 2 | lug-to-lug 46.8 → 46.5 mm, thickness 11.8 → 12.5 mm (UK store) |
| 1245 | TAC08004D0 | AC08004D | Bambino Version 4 | lug-to-lug 48.2 → 49 mm, thickness 11.8 → 12.8 mm (UK store) |
| 1239 | RA-AC0F01B30A | RA-AC0F01B | Symphony III | lug-to-lug 49 → 48.3 mm, thickness 12.1 → 11.7 mm |
| 1240 | RA-AC0E04L30B | RA-AC0E04L | Maestro | lug-to-lug 46 → 46.1 mm |
| 1241 | RA-AK0405Y30B | RA-AK0405Y | Field Sport | lug-to-lug 49.5 → 49.4 mm |
| 1248 | RA-AP0002S30B | RA-AP0002S | Bambino Small Seconds | lug-to-lug 46 → 45.5 mm |
| 4819 | RE-AV0132L | RE-AV0132L | Keshiki Modern Skeleton | thickness filled (12 mm) |
| 1243, 1246, 1247, 1249, 1250, 2006, 2007 | | | | official sources added, dimensions already matched |

The previous values of the seven corrected rows came from the now unreachable US site or from editorial sources. `RA-AA0004E39B` (id 1243) kept its 12.8 mm thickness and 22 mm lug width and `RA-AC0033Y30B` (id 1247) kept its 12.3 mm thickness from the US-site source, because the official pages used here publish no undisputed value for them.

Existing rows with no official match (10, unchanged): `TAA02002D9` Mako (id 1242, the global `AA02002D` page has no dimensions), `RA-AG0003S30B` Bambino Open Heart (id 1244, not in the current catalog), and the editorial rows 2967, 3012, 7041, 7057, 7062, 7067, 7162, 7456 whose reference is the article name.

Stored names that differ from the official name (not applied):

| id | Reference | Stored | Official |
| ---: | --- | --- | --- |
| 19, 6351 | FAC00009N0, FAC00008W0 | Bambino Version 2 | Bambino 40.5mm |
| 1245 | TAC08004D0 | Bambino Version 4 | Bambino 42mm |
| 1243 | RA-AA0004E39B | Kamasu | Diver Design |
| 1249 | RA-AA0818L39B | Mako 3 | Mako Arabic Dial |
| 1247 | RA-AC0033Y30B | Bambino Version 7 40.5mm | Bambino 40.5mm |
| 1240 | RA-AC0E04L30B | Maestro | Contemporary |
| 1239 | RA-AC0F01B30A | Symphony III | Contemporary |
| 1246 | RA-AC0M03S30B | Bambino Version 7 38mm | Bambino 38mm |
| 1241 | RA-AK0405Y30B | Field Sport | Sports |
| 1248 | RA-AP0002S30B | Bambino Small Seconds | Classic & Simple Style |
| 1250 | RA-AS0101S10B | Open Heart Classic | Day & Night |
| 4819 | RE-AV0132L | Keshiki Modern Skeleton | Modern Skeleton |
| 2006, 2007 | RE-BX0006E, RE-BX0009B | M34 F8 Date - Green / - Black | M34 F8 Date |

## Interpretation rules

- **Reference**: the global page heading (`RA-AC0024L`), checked against the URL and the canonical link; on the UK store the URL's `/p/<reference>` segment, checked against the page's `product:retailer_item_id`. Both sites use the base reference; US and other regional catalog numbers add a suffix (`RA-AC0033Y30B`, `FAC00009N0`, `TAC08004D0`). An existing record is treated as the same watch when its reference is the official reference plus a two-digit-and-letter suffix, or an `F`/`S`/`T` prefix and an optional trailing digit around the official reference.
- **Model**: the UK product name without the brand prefix when the UK store sells the reference (141 of the new records: `Bambino 40.5mm`, `Mako 40`, `Contemporary Date`); otherwise the global site's line name (208: `Semi Skeleton`, `Diver Design`, `Classic & Simple Style 38`). 47 new records sit in the global site's `Others` lines and carry only their collection name (`Contemporary`, `Classic`, `Sports`); the US marketing names (Maestro, Symphony, …) are not published by either site.
- **caseMm**: global `Case Size (Width)` or UK `Width`.
- **lugToLugMm**: global `Case Size (Height)` (field `case_length_mm`) or UK `Lug-to-lug`; agreement on 134/134 shared references.
- **thicknessMm**: global `Case Size (Thickness)` or UK `Thickness`.
- **lugWidthMm**: global `Strap Width` or UK `Lug width`.
- When both sites publish a field, the values must be equal. A disputed thickness or lug width is left empty and both notes record both values; a disputed case width or lug-to-lug excludes the reference.
- **Existing records**: official values replace stored values, stored values stay when the official pages publish none, names and existing sources are kept, official URLs are added in front (global first, then UK).
- **Refusals**: preview only unless `--write` (or `--apply`); the importer refuses to write when any product page fails to load or parse, a product linked from a current line page returns 404, the UK listing's declared page count differs from the pages crawled, a reference is filed under different brands on the two sites, or a page publishes invalid dimensions. Pages without dimensions, stale sitemap-only references and cross-source disagreements are excluded and reported, not written.

## Reproduction

```sh
npm run data:import:orient            # preview; caches into /private/tmp/orient-official-catalog
npm run data:import:orient -- --write # apply
npm run data:seed-sql && npm run data:audit && npm test
```

Pass `--refresh` to ignore the page cache, or set `ORIENT_CACHE_DIR` to cache elsewhere.

## Production D1

```sh
npm run data:seed-delta-sql -- --base-ref=<commit before this import>
```

No record was retired by this import.

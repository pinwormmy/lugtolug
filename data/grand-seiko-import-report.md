# Grand Seiko official catalog import report

## Full-catalog sweep (2026-09-09)

Audited the official Grand Seiko global English site (`grand-seiko.com/global-en`) and imported every current product page that publishes a lug-to-lug value. References that only the US site carries were read from their `us-en` pages on the same domain. The importer is `scripts/import-grand-seiko.mjs` (`npm run data:import:grand-seiko`, `--write` to apply); it fetches one page at a time, 750 ms apart, and caches every page in `/private/tmp/grand-seiko-official-catalog`.

Every product page carries the same specification table: `Case size: Diameter 41.0mm Lug-to-lug 49.0mm Thickness 12.5mm` and `Band width: 20mm`.

### Enumeration

The collection listings are rendered client-side, and the global site publishes no sitemap of its own, so products were enumerated three ways and merged by reference:

| Enumeration | Products |
| --- | ---: |
| The site's own search index, `GlobalEn` category (400 documents in 4 pages) | 149 product documents, 30 of them stale entries whose indexed title is the site's own "404 Page Not Found" → 119 live |
| Server-rendered links on the six collection pages (`all`, `heritage`, `elegance`, `evolution9`, `sport`, `masterpiece`) | 44 |
| US sitemap (`us-enGrandSeikoSitemap1.xml`, same references under `us-en`) | 146 |
| Union | 146 references |

- **146/146 product pages fetched and parsed** with no request or parsing failures: 120 from `global-en`, 26 from `us-en` because the global site answers those references with its "404 Page Not Found" page (US special and limited editions such as `SBGA489`, `SBGA507`, `SLGA001`).
- **145 references importable**; `SBGH263` (US page) publishes `Case size: Diameter 39.5mm Thickness 13.1mm` without a lug-to-lug value and was excluded.
- No page had conflicting values. Pages that list a strap and a bracelet repeat the `Band width` row as `20mm` and `20 mm`; identical values are accepted, differing values would leave the lug width empty.
- Published lug-to-lug values range from **32.9 mm to 52 mm**; by collection: Heritage 70, Evolution 9 28, Elegance 23, Sport 19, Masterpiece 5.

### Records

- **30 new records** (ids 8137–8166; 17 from `us-en`, 13 from `global-en`) and **115 existing records updated** with the official dimensions and product URL. 87 existing Grand Seiko records have no reference in the current catalog (withdrawn models, editorial rows) and were left unchanged.
- Grand Seiko now holds 232 records (202 before): 153 cite an official product page (73 before), 168 have a thickness (111 before) and 219 have a lug width (174 before).
- 42 updated records received a dimension change: 27 gained a thickness, 15 gained a lug width, and five stored values were corrected.

Official-source corrections applied:

| id | Reference | Stored name | Correction |
| ---: | --- | --- | --- |
| 6417 | SBGA429 | Soko Shadow Special Edition | lug-to-lug 47 → 46.8 mm (US page) |
| 4299 | SBGH349 | Heritage Icefall | lug-to-lug 46 → 46.6 mm |
| 1868 | SBGJ271 | Hi-Beat GMT Yukigesho | thickness 14 → 14.1 mm |
| 1857 | SBGX357 | Heritage Collection | thickness 10 → 10.6 mm |
| 7244 | SLGB007 | Evolution 9 Spring Drive U.F.A. SLGB007 | lug-to-lug 48 → 47.2 mm |

Stored names were kept; 99 updated records differ from the official page title (for example id 10 `Snowflake Spring Drive` vs. `Heritage Collection Automatic Spring Drive 3-Day`, id 1840 `‘Katana’ U.S. Exclusive Collection` vs. `USA Special Edition Inspired by the Katana`). The full list is in the importer output under `nameDifferences`.

## Interpretation rules

- **Reference**: the page heading (`SBGA211`), which omits the regional suffix letter of the URL (`sbga211g`, `sbgd201j`); the heading must be the start of the URL slug and the canonical link must match the fetched path. Existing records are matched on the compact reference.
- **Model** (new records only): the page header, without the `Grand Seiko` prefix. When the header lists the collection and a movement family (`Heritage Collection` / `Automatic Spring Drive 3-Day` / `SBGA211`), the model is `collection + family`; when it carries a title instead (`USA Special Edition` / `Inspired by the Katana`), the title lines are joined; when a regional page has no header, the model is the collection label plus the specification table's `Movement Type` (`Heritage Collection Spring Drive Self-winding with Manual-winding`). Of the 30 new records, 2 are collection + family, 12 header titles and 16 collection + movement type.
- **caseMm**: `Diameter` from the `Case size` row (a `Width` value would be stored the same way; none occurred).
- **lugToLugMm**: `Lug-to-lug` from the `Case size` row.
- **thicknessMm**: `Thickness` from the `Case size` row.
- **lugWidthMm**: the `Band width` row.
- **Existing records**: official values replace stored values, stored values stay when the page publishes none, names, grouping metadata and existing sources are kept, the official URL is added in front (the 73 rows that already cited a `us-en` page keep it and gain the `global-en` page).
- **Refusals**: preview only unless `--write` (or `--apply`); the importer refuses to write when any product page fails to load or parse, a listed product has no page on either locale, or a page publishes invalid dimensions. Pages without lug-to-lug, stale index entries and soft-404 answers are excluded and reported.

## Reproduction

```sh
npm run data:import:grand-seiko            # preview; caches into /private/tmp/grand-seiko-official-catalog
npm run data:import:grand-seiko -- --write # apply
npm run data:seed-sql && npm run data:audit && npm test
```

Pass `--refresh` to ignore the page cache, or set `GRAND_SEIKO_CACHE_DIR` to cache elsewhere.

## Production D1

```sh
npm run data:seed-delta-sql -- --base-ref=<commit before this import>
```

No record was retired by this import.

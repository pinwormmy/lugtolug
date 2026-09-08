# Brand coverage review

Date: 2026-09-08 (after the brand name normalization)

The seed holds 7,412 records across 518 brands. "Official" below counts records with at least one manufacturer-domain source; "retailer" counts records whose best source is a retailer that publishes lug-to-lug (helveti.eu, Teddy Baldassarre); "editorial only" counts records sourced solely from reviews, Delugs, Hodinkee, MONOCHROME or similar. Official sites were not re-checked for this review; where a brand is said to publish lug-to-lug, the evidence is the official source notes already in the seed.

## 1. Official data exists, coverage is thin

Candidates for a full-catalog importer in the style of `scripts/import-doxa.mjs` and `scripts/import-union-glashuette.mjs`.

| Brand | Records | Official | Thickness | Lug width | Note |
| --- | ---: | ---: | ---: | ---: | --- |
| NOMOS | 123 | 10 | 28% | 90% | Official product pages publish diameter, height, lug-to-lug and lug width; 86 of the 123 records are Delugs rows without thickness. |
| Orient | 20 | 13 | 75% | 70% | Orient Watch USA publishes lug-to-lug; the smallest catalog coverage of any mainstream brand. |
| Grand Seiko | 202 | 73 | 55% | 86% | Official pages publish lug-to-lug for every current model; 89 records are Delugs rows and 91 lack thickness. |
| Seiko | 390 | 283 | 92% | 85% | Official pages publish lug-to-lug; the largest search demand of any brand in the seed. |
| Casio | 95 | 11 | 99% | 16% | Official pages publish L x W x H for every model; lug width is never published. Only 11 records cite casio.com. |
| Hamilton | 80 | 19 | 85% | 78% | Official pages do not publish lug-to-lug; helveti.eu does and supplied 201 Tissot rows but only 29 Hamilton rows. |
| Mido | 59 | 17 | 80% | 66% | Same helveti.eu route as Hamilton; 12 rows so far. |
| Certina | 52 | 17 | 98% | 88% | Same helveti.eu route; 27 rows so far. |
| Rado | 29 | 5 | 79% | 21% | Same helveti.eu route; no rows yet. |

Citizen (53 records) is deliberately not listed: its official pages do not publish lug-to-lug, and the existing Citizen values are marked as operator-maintained case-family estimates.

## 2. Well-known brands with almost no records

Candidates for the 10-12 record official batches used for Baltic, Farer and Lorier. Whether these official sites publish lug-to-lug was not verified.

- **German brands**: Sinn 10, Laco 7, Junghans 4, Stowa 3, Damasko 1, Tutima 1
- **Value brands**: Steinhart 0, San Martin 0, Pagani Design 0, Vostok 1
- **Microbrands**: Marathon 18, Spinnaker 13, Monta 9, Brew 7, Halios 3, Boldr 3, Islander 2, Dan Henry 1, Vario 1
- **Mainstream**: Bulova 9, Baume & Mercier 9, Zodiac 9, Frederique Constant 6, Raymond Weil 5, Victorinox 4, Luminox 3, Maurice Lacroix 2, Glycine 0
- **Luxury**: Girard-Perregaux 9, Chopard 8, Hublot 7, Montblanc 7

Sinn's official product sheets list diameter, thickness and lug width but not lug-to-lug; the existing Sinn rows take lug-to-lug from the WatchBuys distributor pages.

## 3. Many records, hollow fields

Adding thickness and lug width to existing rows is worth more here than new rows.

| Brand | Records | Thickness | Lug width | Official | Editorial only |
| --- | ---: | ---: | ---: | ---: | ---: |
| Breitling | 298 | 70 | 250 | 0 | 298 |
| Cartier | 196 | 54 | 78 | 8 | 188 |
| TAG Heuer | 116 | 98 | 17 | 5 | 111 |
| Zenith | 59 | 47 | 12 | 5 | 54 |
| Jaeger-LeCoultre | 75 | 39 | 29 | 5 | 70 |
| anOrdain | 55 | 1 | 55 | 0 | 55 |
| Armin Strom | 53 | 5 | 42 | 0 | 53 |
| Bell & Ross | 49 | 0 | 37 | 0 | 49 |
| Richard Mille | 38 | 36 | 0 | 0 | 38 |
| F.P. Journe | 38 | 3 | 35 | 0 | 38 |
| H. Moser & Cie. | 38 | 3 | 32 | 0 | 38 |
| Glashütte Original | 80 | 29 | 58 | 5 | 75 |

Tudor (52 records) and Rolex (50) belong here too, but their official pages do not publish lug-to-lug, so growth depends on reviews and databases. Oris is in the same position; Teddy Baldassarre publishes lug-to-lug for Oris and already supplies 13 of its 56 records.

## 4. Slug follow-up

`slugify` replaces accented letters with `-`, so Glashütte Original lives at `/brands/glash-tte-original`, Union Glashütte at `/brands/union-glash-tte` and Hermès at `/brands/herm-s`. Transliterating diacritics would change 24 brand slugs (224 records) and 250 model slugs, all live URLs, so it needs `_redirects` rules and a deliberate decision; see `data/brand-name-normalization-report.md`.

## Reproduction

Counts come from `data/watches.seed.json`; the per-brand table behind this review groups source hosts into manufacturer, retailer and editorial buckets by domain.

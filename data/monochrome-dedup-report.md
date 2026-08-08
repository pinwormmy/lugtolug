# MONOCHROME duplicate audit report

Generated on 2026-08-08 after the full-site MONOCHROME lug-to-lug import.

## Audit method

The audit treated a seed row as one watch/reference or one explicitly retained
collection-level identity. It checked unique IDs, normalized references, full
dimension tuples, same-brand near matches, shared source URLs, article-title
identity, and reference/model names found in the archived MONOCHROME article
text. Matching dimensions alone were never sufficient to merge a row.

The initial 7,461-row seed had no duplicate IDs and no duplicate normalized
reference plus full-dimension tuple. Cross-source identity review found 24
MONOCHROME import rows that duplicated stronger existing product/reference
records. Dial, material, generation, complication, and limited-edition
variants were retained when their identity differed.

## Result

| Metric | Result |
| --- | ---: |
| Seed rows before review | 7,461 |
| Confirmed duplicate rows retired | 24 |
| Seed rows after review | 7,437 |
| Source associations transferred | 62 |
| Misassigned source associations corrected | 3 |
| MONOCHROME source associations after review | 2,274 |
| Unique MONOCHROME article pages retained | 1,404 |

All 24 retired rows were MONOCHROME import artifacts with IDs in the
6,984–7,450 range. Their article sources were copied to the canonical product
records before removal.

## Confirmed merges

| Retired ID | Canonical ID(s) | Identity evidence |
| ---: | --- | --- |
| 6984 | 347 | Omega Silver Snoopy, ref. `310.32.42.50.02.001` |
| 7036 | 427, 430, 435, 438 | Four Omega Constellation references named in the article |
| 7093 | 2851 | Czapek Place Vendôme Complicité |
| 7135 | 364 | Omega First Omega in Space, ref. `310.30.40.50.06.001` |
| 7151 | 1211, 2168–2171 | TAG Heuer Formula 1 mechanical collection |
| 7165 | 6117 | Nivada Grenchen F77 Mk2 |
| 7167 | 4130, 4131, 4136, 4161, 4164 | Five named Farer Lissom models |
| 7169 | 308, 311, 312, 319 | Four-reference 2025 Omega Railmaster collection |
| 7175 | 1825, 1826 | Glashütte Original PanoLunarTourbillon strap references |
| 7227 | 1934, 1935 | Kiwame Tokyo MUNE refs. `KT201` and `KT202` |
| 7232 | 872–875 | Seiko refs. `HDB006`–`HDB009` named in both articles |
| 7234 | 2738 | Timex Giorgio Galli S2Ti |
| 7248 | 6264–6267 | Studio Underd0g 02Series Gen 2 references |
| 7267 | 6694 | Konstantin Chaykin Cinema |
| 7280 | 6839 | HYT H3 |
| 7336 | 6629 | Hamilton PSR |
| 7339 | 6085, 6725 | Baume & Mercier Hampton 2020 models |
| 7353 | 6837 | Hermès H08 2021 collection |
| 7371 | 6824 | Girard-Perregaux Casquette 2.0 |
| 7404 | 2199–2201 | Three-reference Tissot Sideral collection |
| 7427 | 6647 | Cartier Privé Tortue Monopusher Chronograph 2024 |
| 7430 | 6721 | Anoma A1 launch model |
| 7448 | 348 | Omega Speedmaster, ref. `311.90.42.30.99.002` |
| 7450 | 3318, 3321, 3322, 3324 | Bianchet B 1.618 UltraFino titanium variants |

## Source corrections

- Removed the Mansart Small Second article from the 34mm March LA.B Mansart
  row; it remains on the correct 35mm Small Second record 2643.
- Removed the Gerald Charles Maestro 3.0 Seddiqi article from the Maestro 2.0
  row; it remains on the correct chronograph record 7359.
- Moved the Gerald Charles Maestro 9.0 Roman Tourbillon article from the
  Maestro 2.0 row to the Maestro 9.0 record 7396.

The reproducible cleanup is implemented by
`npm run data:dedup:monochrome -- --apply`. Removed rows are included in the
seed retirement list, and the delta SQL generator now archives removed seed
rows and deletes stale source associations during production updates.

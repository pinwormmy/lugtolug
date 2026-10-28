# Tier-1 reference cleanup (2026-10-28)

288 tier-1-brand rows held the watch name (or an IntoWatch `name IW<no>` label) in `reference`. Each was checked against its own sources, the brand's site and reputable dealers/databases. A reference was written only when a source ties it to that exact watch; otherwise `reference` is now empty (shown as "Reference not provided"). Every changed row keeps its old route in `data/legacy-routes.json`.

| Result | Rows |
|---|---:|
| Reference written | 107 |
| Empty: one row covers several references (dial/metal/strap/size) | 132 |
| Empty: no manufacturer reference found | 14 |
| Empty: reference already on another row (duplicate candidate) | 26 |
| Empty: conflicting evidence or wrong row data | 7 |
| Already a real reference (RM 66) | 1 |
| Deleted (8284, added on this branch with another Captain Cook's dimensions) | 1 |

F.P. Journe references are the brand's model codes (Ref. CB, LN, AL2 …), shared by every size of a model. Where two dial variants share a code and identical dimensions (4079/4082 CS, 4095/4104 AL2, 4106/4108 AL), the second row is left empty because the seed requires unique product numbers.

## Duplicates merged

The confirmed reference already belonged to another row, so 26 rows were the same watch imported twice (once with a real reference, once by name from an article). Each was retired into the numbered row: its sources and any missing thickness/lug width moved over when both rows agree on lug-to-lug and case size, and its old route now redirects to the surviving row. For 2682, 6596, 6842, 7148, 7307 and 7413 the duplicate's figures were misread (e.g. 7148's 44.25 mm case, 7413's 39 mm "lug-to-lug"), so only the redirect moved.

| retired | → kept |
|---|---|
| 2682 | 4864 |
| 2709 | 2265 |
| 2733 | 1870 |
| 2767 | 3450 |
| 2772 | 3530 |
| 2781 | 6125 |
| 2818 | 1687 |
| 2836 | 3536 |
| 2848 | 389 |
| 2905 | 4706 |
| 2919 | 2004 |
| 2933 | 1829 |
| 2938 | 3481 |
| 5074 | 1609 |
| 5075 | 6285 |
| 6166 | 1609 |
| 6549 | 299 |
| 6551 | 4690 |
| 6596 | 3495 |
| 6626 | 6213 |
| 6842 | 1831 |
| 7148 | 404 |
| 7307 | 3790 |
| 7413 | 2188 |
| 8192 | 6162 |
| 8194 | 1827 |

Empty-reference pairs with identical dimensions were checked and are different watches sharing a case size (6540/2818, 6997/6965, 7218/6967, 8181/2995); they stay.

## Row data corrected

- 6860: renamed G-Shock Mudmaster GWG-2000 — the 61.2 × 54.4 × 16.1 mm in the Hodinkee article are listed under the Mudmaster, not a Rangeman.
- 6902: renamed Reverso Tribute Monoface Or Deco Solo Tempo, reference Q716216J, lug-to-lug 40.1 mm, per Jaeger-LeCoultre's technical characteristics.
- 6424 Reverso Tribute Enamel Horse: case width 27.4 mm (was 29.9) per Jaeger-LeCoultre.
- 7148 Speedmaster Pilot: merged into 404, which already carries the 40.85 mm case.
- TAG Heuer Monaco 39 mm (7286, 7311, 7314, 7324, 7325, 7328, 7329, 7344, 7377): lug-to-lug 47.4 mm. MONOCHROME's "39 × 39 mm" case figure had been imported as lug-to-lug; Time+Tide, Hodinkee and aBlogtoWatch measure the 39 mm Monaco case at 47.4 mm across Calibre 11, 12 and Heuer 02 references.

## Retired without a replacement

- 6398 Vacheron Constantin Traditionnelle Twin Beat: its figures were the Breguet 7077 from the same article (already row 1681); no Twin Beat lug-to-lug is published.
- 7363 Monaco Carbon Only Watch and 7492 Monaco Speed 12: the stored lug-to-lug was the case width and no real figure is published.

## Also corrected

- Certina DS-2 1432–1435 lug-to-lug 46 mm; Hamilton Murph 38 6297 retired into 1877; Citizen Series 8 GMT 6368 retired into 8297 (see `fratello-novelties-2026-10-report.md`).
- The name-as-reference heuristic missed names containing a size token (e.g. "Khaki Field Murph 38mm"); the remaining-rows pass needs a wider match.

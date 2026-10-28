# Remaining-rows reference cleanup (2026-10-28)

Second pass after `reference-cleanup-tier1-report.md`: 1,766 rows whose `reference` held a name (or an IntoWatch `name IW<no>` label) across 443 brands, found with a wider match that no longer mistakes size tokens ("38mm", "300M") for references. Each row was checked against its sources, the brand's site and reputable dealers; references were written only when a source ties them to that exact watch, otherwise `reference` is empty.

| Research result | Rows |
|---|---:|
| Reference confirmed | 302 |
| Already the brand's real reference (kept) | 153 |
| One row spans several references | 433 |
| No reference published / not found | 878 |

After review 229 rows received a reference and the rest are empty. 23 confirmed references were dropped because sources disagree (e.g. Armin Strom ST25 vs ST24-OW.05, Norqain old vs new numbering, Orient Star SDV02002B vs DV02002B) or the code only appears in a retailer listing (11 Gruppo Gamma codes known only from IntoWatch titles).

Brands that publish no reference numbers (only model names or shop SKUs), so all their rows are empty: Farer, Borealis, NTH, Nodus, Zelos, Zentier, anOrdain, Brew, Baltic, Vaer, Venturo and many smaller makers.

Model-code brands (Richard Mille, Ming, Naoya Hida & Co., AkriviA, Gruppo Gamma) keep their code only on one row per code; colour or athlete editions that share the base code are left empty (28 rows).

## Duplicates merged

37 rows were the same watch as another row (the confirmed reference already belonged to it, or delugs strap-finder colour rows became identical once the colour suffix was removed from the reference). They were retired into the surviving row with their routes redirected; sources moved only where lug-to-lug and case size agree.

apply: 6639→1734, 6926→1484, 8324→1172, 7038→4316, 7288→6925, 7198→339, 7162→7868, 2770→2037, 7398→7394, 2758→3195, 3204→3170, 3664→2870, 3651→2857, 5056→1797, 2872→1547, 6243→1565, 6407→4589, 2616→5639, 2967→8095, 2753→2016, 1355→2102, 1357→2101, 1358→2104, 2627→1337.

colour rows: 3168→3159, 3672→3666, 3673→3662, 3680→3654, 4574/4578→4573, 4580/4581→4576, 4611→4610, 4615→1320, 3108→6722, 7166→3660, 7419→6378.

Data problems spotted during the research (wrong dimensions, mixed models, misnamed rows) are listed and handled in `data-fix-2026-10-report.md`.

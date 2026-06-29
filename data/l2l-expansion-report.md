# Lug-to-Lug Data Expansion Report

Updated: 2026-06-19

## Repository conventions

- Source data: `data/watches.seed.json`
- Units: millimeters
- Ordering: append-only by numeric `id`
- Duplicate key: normalized `brand + model + reference + caseMm`
- Source metadata: official or verification status is recorded in `sources[].note` because the current schema has no `sourceType` field.
- Optional fields that are not published are left as `null`; the schema was not changed.

## Completed batches

### Delugs Strap Finder

- Added models: 1,984
- Source rows reviewed: 8,544
- Rows with numeric lug-to-lug and case diameter: 2,228
- Existing brand/reference records skipped: 244
- Panerai rows reviewed: 68
- Panerai rows with numeric lug-to-lug: 1
- Panerai additions: PAM02973
- Insufficient-information Panerai exclusions: 67

Delugs Strap Finder publishes a public API used by its strap finder page. This batch imported only active API rows with numeric `lugToLugDistance` and `caseDiameter` values. Existing seed records with the same brand/reference were left unchanged to avoid overwriting stronger or conflicting sources. Delugs rows whose lug-to-lug value was `-` were excluded rather than published with inferred measurements.

### Grand Seiko

- Added models: 18
- Reached 10-model target: yes
- Official-source additions: 18
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Grand Seiko official collection pages publish explicit case diameter, lug-to-lug length, thickness, and band width. This batch filled prominent missing Korean-market brand references and normalized several existing case families with `canonicalModel` and `modelGroup` metadata for cleaner grouped display.

Added references:

- SBGN027
- SBGN029
- SBGE285
- SBGE307
- SBGW258
- SBGW283
- SBGW285
- SBGW287
- SBGY011
- SBGY013
- SBGX359
- SBGX361
- SBGX355
- SLGA009
- SLGB005
- SLGB006
- SLGH013
- SBGH376

### Casio

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Casio publishes case dimensions as `L x W x H`. Following the requested acceptance of official case length, the values are stored as:

- `lugToLugMm`: official `L`
- `caseMm`: official `W`
- `thicknessMm`: official `H`
- `lugWidthMm`: `null` because Casio does not publish it on these product pages

Added references:

- GA-2100-1A1
- GA-B2100-1A
- GM-2100-1A
- GM-B2100D-1A
- GMA-S2100-4A
- GM-5600-1
- GM-S5600PG-1
- MRG-B2100D-1A
- GMC-B2100D-1A
- A168WA-1W
- EFR-S108D-1AV

### Orient

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 1

Orient Watch USA publishes explicit case diameter, lug-to-lug length, thickness, and lug width values. The existing Bambino Version 2 reference `FAC00009N0` was retained without duplication.

Added references:

- RA-AC0F01B30A
- RA-AC0E04L30B
- RA-AK0405Y30B
- TAA02002D9
- RA-AA0004E39B
- RA-AG0003S30B
- TAC08004D0
- RA-AC0M03S30B
- RA-AC0033Y30B
- RA-AP0002S30B
- RA-AA0818L39B
- RA-AS0101S10B

Excluded conflicts:

- RA-AC0R02L30B Stretto Date: the official page presents conflicting summary and detailed dimensions, so it was not added.

### NOMOS

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

NOMOS official product pages publish explicit diameter or square case size, lug-to-lug, height, and lug width values. Representative models were selected across Tangente, Club, Metro, Orion, and Tetra.

Added references:

- 101
- 175
- 149
- 182
- 703.1
- 708
- 1108
- 384
- 401
- 408

### Christopher Ward

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Official Christopher Ward product handbooks publish diameter, lug-to-lug, height, and strap width. Where a handbook does not expose a unique SKU, the official handbook model identifier is used in `reference`; exact handbook product codes are used where published.

Added references:

- C12 The Twelve 38mm
- C12 The Twelve 36
- C60 Concept
- C60 Anthropocene GMT
- C60 Chronograph
- C1 Bel Canto The Red One
- C65-41ADA2
- C63-39CGM3-S0KK0
- C65 Trident Classic Vintage
- C65 Black Gold Limited Edition
- C65 Dartmouth Series 2
- C65 Dune Automatic

### Formex

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Formex official product pages publish unique SKUs with diameter, lug-to-lug, height, and lug width. Separate dial variants were added only when the official page exposed a distinct SKU.

Added references:

- 0660.1.6533.133
- 0660.1.6593.799
- 0660.1.6555.822
- 2201.1.6312.900
- 2201.1.6300.910
- 2201.1.6382.100
- 2201.1.6399.100
- 2201.1.6367.100
- 2200.1.6333.801
- 2202.1.5323.711
- 0330.1.6321.100

### Vaer

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 5

Vaer official product pages publish case diameter, lug-to-lug distance, thickness, and lug width. Vaer does not expose separate product SKUs on these pages, so the official product name is used in `reference`.

Added references:

- C5 Recon Field Solar 40mm USA
- R1 Tactical Chronograph 40mm USA
- R1 Oceanracer Chronograph Panda 42mm
- S5 Calendar Field White 40mm Quartz
- RS1 Rally Chronograph Panda 40mm
- S3 Calendar Field Black 36mm Quartz
- S3 Tactical Field 36mm Quartz
- A5 Tactical Field Auto 40mm USA
- A5 Atlas Black Auto 38mm USA
- A5 Field Black 40mm USA
- D4 Meridian Black Solar Diver 42mm USA
- D4 Outerknown Marine Solar Diver 39mm USA

Excluded conflicts:

- R1 Racing Chronograph Cream 42mm USA: official technical details and sizing text disagree on lug-to-lug.
- R1 Racing Chronograph Black 42mm USA: official technical details and sizing text disagree on lug-to-lug.
- R1 Racing Chronograph Blue 42mm USA: official technical details and sizing text disagree on lug-to-lug.
- S5 Tactical Field: official page disagrees on whether the case is 40 mm or 42 mm.
- Vaer x Outerknown D4 USA Solar Diver 38mm: official page disagrees on case thickness.

### Baltic

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Baltic official product pages publish case diameter, lug-to-lug distance, thickness, and lug width. Baltic does not expose separate product SKUs on these pages, so the official product name is used in `reference`.

Added references:

- Hermétique Summer Pink
- Aquascaphe GMT Green
- MR Classic Salmon
- Prismic Grey blue
- Aquascaphe Classic Blue Gilt
- Scalegraph Classic Panda
- HMS 003 Silver Blue
- Aquascaphe Dual-Crown Blue
- Aquascaphe Bronze Brown
- Aquascaphe Titanium Blue

### Farer

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 1

Farer official product pages publish case diameter, lug-to-lug distance, depth, and lug width. Farer does not expose separate product SKUs on these pages, so the official product name is used in `reference`.

Added references:

- Resolute III
- Maze III - 40mm
- Discovery Olive
- Charlton Green - 38mm
- Lander Kano 36mm
- Aurora
- Discovery Black Velvet 36mm
- Erebus II
- Portobello Black Limited Edition
- Tenebris

Excluded conflicts:

- Lander IV 39.5mm: the official product page lists 11.3 mm depth in the specification table but 10.8 mm thickness in the feature text.

### Nodus

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Nodus official product pages publish case width, lug-to-lug distance, thickness, and lug width. Where a page separately lists bezel width and case width, `caseMm` stores the official case width. Nodus does not expose separate product SKUs on these pages, so the official product name is used in `reference`.

Added references:

- Sector Deep Pioneer - Admiral
- Sector II Sport - Marigold
- Sector Deep - Black Destro
- Sector Deep - Flare Destro
- Duality II - Chasm Black
- Sector II Field Titanium - Marina
- Sector II Pilot - DLC
- Duality II - Drift Blue
- Unity - Vitreous Pink
- Sentinel for AMMO NYC
- Unity - Pearl White

### Traska

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Traska official product pages publish dimensions as technical drawings. The drawings separately label case-body height and total height including the raised crystal; `thicknessMm` stores the total height. The Commuter size names are nominal, so `caseMm` stores the exact diameter shown in the official drawing. Product names are used in `reference` where no separate reference number is published.

Added references:

- Commuter 34 Malachite
- Commuter 34 Lapis Lazuli
- Commuter 34 Onyx
- Commuter 36 Malachite
- Commuter 36 Lapis Lazuli
- Commuter 36 Onyx
- Commuter 38 Malachite
- Commuter 38 Lapis Lazuli
- Commuter 38 Onyx
- 4215
- 10251
- 1186

### Lorier

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Lorier official product pages publish case width, case-body thickness, dome-crystal height, case length/lug-to-lug, and lug width. To match the seed's total-height convention, `thicknessMm` stores the sum of the published case-body thickness and dome-crystal height. Lorier does not publish separate reference numbers on these pages, so the complete official product name is used in `reference`.

Added references:

- Astra
- Astra Cosmic Blue
- Olympia Series II
- Falcon Series III
- Merlin Limited Edition
- Zephyr White Special Edition
- Roosevelt Limited Edition
- Hydra Series III Zulu
- Hydra Series III
- Hyperion Series II
- Neptune Series IV No Date
- Hyperion Series II Skyward

### Studio Underd0g

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Studio Underd0g official product pages publish case diameter and total thickness together with lug-to-lug distance and lug width. The pages do not publish separate reference numbers, so the complete official product name is used in `reference`.

Added references:

- Watermel0n (Gen3)
- Desert Sky (Gen3)
- Go0fy Panda (Gen3)
- Mint Ch0c Chip (Gen3)
- Midnight
- Pink Lem0nade
- Full Mo0n
- Steffany Blue
- Salm0n
- Champagne & Caviar

### Zelos

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Zelos official product pages publish diameter, lug-to-lug length, thickness with crystal, and lug width. `thicknessMm` stores the published thickness with crystal. The pages do not publish separate reference numbers, so the complete official product name is used in `reference`.

Added references:

- Hammerhead 43 Field DLC 'Storm' Launch Special
- Hammerhead 43 Field Br 'Bedrock' Launch Special
- Hammerhead 43 Field Br 'Vesper' Launch Special
- Hammerhead 43 Field Br 'Mosaic MOP' Launch Special
- Hammerhead 43 Field 'Purple Agate'
- Hammerhead 43 Field 'Mosaic Ember'
- Hammerhead 43 Field 'Carbon'
- Helica 39 'Kyanite'
- Helica 39 'Mosaic MOP'
- Helica 39 'Red Opal'
- Helica 39 'Galaxy'
- Helica 39 'Vesper'

### Unimatic

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Unimatic official technical-specification PDFs publish reference numbers, case dimensions, height lug-to-lug, thickness both without and with the lens, and lug size. `thicknessMm` stores the published thickness with the lens. Where a PDF lists both a 40 mm case diameter and 41.5 mm diameter with the bezel, `caseMm` stores the 40 mm case-body diameter and the bezel-inclusive value is retained in the source note.

Added references:

- U5S-BLN
- U5S-NS
- UT4-U-TI-GMT
- U4S-T-LB
- U1S-GMT-YPO26
- UC1
- UC3
- UT4-U-TI
- U4S-T-SPW
- U3S-M
- U1S-MD

### Yema

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 1
- Source-conflict exclusions: 0

Yema official product pages publish product references or SKUs together with case diameter, lug-to-lug, thickness, and lug width. Only pages with an exact published thickness are included.

Added references:

- 12.25.20.66.SN.M3
- 12.25.20.11.SN.M3
- 21.14.75.SN.M
- 21.14.55.SN.M
- 21.14.36.SN.M
- 12.26.20.39.ZNL.U9
- 12.24.99.SN.M3
- YNAV23MN-AMS
- 20.26.20.05.TN.U6
- 12.26.11.66.TNL.MT
- 64.25.10.05.TN.D5

Excluded for insufficient information:

- Navygraf Pearl CMM.20: the official page describes thickness only as "under 10mm," so it was excluded rather than storing an approximate value.

### Serica

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 6
- Source-conflict exclusions: 4

Serica official product pages publish product references together with case diameter, lug-to-lug, thickness, and lug width. Only product pages with a complete and internally consistent official specification set are included.

Added references:

- 6190-1
- 6190-3
- 6190-2
- 6190 Commando
- 6190 TXD
- 8315-1
- 8315-2
- 5330
- 7505-1
- 7505-2
- 7505 TXD

Excluded for insufficient information:

- 6190 California and 6190 Denali: the current official product pages do not publish a lug-to-lug value.
- 5303-1, 5303-2, 5303-3, and 5303 PLD: the current official product pages publish diameter, thickness, and bracelet dimensions but no lug-to-lug value.

Excluded for source conflicts:

- 1174 Parade Brass, 1174 Parade Satin Black, 1174-3 Parade, and 1174-4 Parade: each official page lists 35 x 41 mm case dimensions while also labeling 18 mm as lug-to-lug. The 18 mm value conflicts with the published case dimensions and appears to be a lug or strap dimension, so these entries were excluded.

### Timex

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Timex official product pages publish Product IDs together with case diameter, lug-to-lug distance, case height, and band/lug width. Distinct strap and bracelet products are retained only when Timex assigns them different Product IDs.

Added references:

- TW5M68900
- TW2Y70300
- TW2Y63700
- TW2Y64500
- TW2Y47600
- TW2Y33300
- TW2Y60600
- TW2Y56700
- TW2Y49900
- TW2Y56800

### Doxa

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

DOXA official product pages publish SKUs together with two-axis CASE dimensions, case height, and lug width. The first CASE dimension is stored as `caseMm`, and the second published case dimension is stored as case length/L2L; this mapping is retained in each source note.

Added references:

- 796.10.351.10
- 796.10.101.10
- 796.10.021.10
- 796.10.201.10
- 796.10.361.10
- 796.10.241.10
- 796.10.011.10
- 796.10.131.10
- 821.10.351.10
- 862.10.351.21-N

### Certina

- Added models: 12
- Reached 10-model target: yes
- Official-source additions: 12
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Certina official product pages publish references together with separate Length, Width, Height, and Between lugs values. Official Width is stored as `caseMm`, official Length as case length/L2L, Height as `thicknessMm`, and Between lugs as `lugWidthMm`; this mapping is retained in each source note.

Added references:

- C033.460.16.087.00
- C033.460.11.057.00
- C033.460.16.037.00
- C033.460.16.047.00
- C041.407.19.041.01
- C041.407.39.051.00
- C024.407.18.041.00
- C024.407.18.081.00
- C024.407.11.051.00
- C024.407.37.361.00
- C024.607.48.051.10
- C047.452.11.081.00

### Mido

- Added models: 11
- Reached 10-model target: yes
- Official-source additions: 11
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 1
- Source-conflict exclusions: 0

Mido official product pages publish references together with separate Case length, Width, Average Thickness, and Lugs width values. Official Width is stored as `caseMm`, official Case length as L2L, Average Thickness as `thicknessMm`, and Lugs width as `lugWidthMm`; this mapping is retained in each source note.

Added references:

- M038.430.11.041.00
- M049.526.44.081.00
- M021.431.11.031.00
- M049.526.17.081.01
- M049.526.33.021.00
- M021.430.33.091.00
- M021.407.11.411.03
- M038.430.16.031.00
- M049.527.33.081.00
- M038.429.11.041.00
- M040.407.36.060.00

Excluded for insufficient information:

- Commander 1959 M7169.3.72.13: the official page publishes `0.00 mm` for Lugs width, so the entry was excluded rather than storing an invalid dimension.

### Rolex

- Added models: 10
- Reached 10-model target: yes
- Official-source additions: 10
- Verified-external additions: 10
- Duplicate candidates skipped: 4
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 0

Rolex popular-model candidates were selected by cross-checking Bob's Watches' 2026/top-popular Rolex coverage with WatchCharts' Rolex collection and popular-watch price pages. Existing Rolex records were excluded before insertion. Rolex official pages and brochures were used to confirm current reference identity and case size where available; WatchSpecs, WatchCharts, Bob's Watches, Millenary, and Delugs were used for lug-to-lug, thickness, and lug-width cross-checks because Rolex generally does not publish every wearable dimension.

Added references:

- 124060
- 126610LV
- 126710BLNR
- 126720VTNR
- 126500LN
- 124300
- 126622
- 126600
- 226570
- 228238

Skipped duplicate Rolex references already present:

- 126610LN
- 124270
- 126334
- 126710BLRO

## 2026-06-23 Worn & Wound Review Batch and Seed Cleanup

### Worn & Wound

- Review archive scope checked: page 1 of the current archive, with pagination showing 36 total pages.
- Added models: 9
- Existing models augmented with Worn & Wound source notes: 3
- Official-source additions: 0
- Verified-external additions: 12
- Exact duplicate seed rows merged: 4
- Insufficient-information exclusions: 2
- Source-conflict exclusions: 0

The current Worn & Wound review archive exposes a large historical review set. This batch records high-confidence current-page entries where Worn & Wound published explicit dimensions or article text sufficient to map `lugToLugMm`, `caseMm`, and `thicknessMm`. Remote bulk collection was not completed in this pass.

Added references:

- OG Watches Deep Space Blue
- Trafford Watch Co. Crossroads S 36
- Trafford Watch Co. Crossroads S 40
- Atelier Wen Inflection
- Atelier Wen Millésime 2025 Perception
- Venezianico Arsenale Calendario
- Casio G-SHOCK DW-5600MNC
- Wolbrook JetFlyer
- Maen Grand Tonneau Ultra-Thin

Existing records augmented or corrected:

- Fears Arnos Pewter Blue BS422.600: added Worn & Wound source and corrected rectangular `caseMm` to the 22.6mm width while retaining 40mm lug-to-lug.
- Traska The Chronograph 10251: added Worn & Wound source matching the official 39 x 46.5mm, 13.75mm, 21mm dimensions.
- Hanhart Aquasphere Ocean Fade 777.271: added Worn & Wound review-source cross-check for the black-bezel sample while retaining the official 12.95mm thickness.

Merged exact duplicate seed rows:

- Omega 21030422001018 into dotted reference 210.30.42.20.01.018.
- Omega 21032422001006 into dotted reference 210.32.42.20.01.006.
- Mido M0269071104100 into dotted reference M026.907.11.041.00.
- King Seiko SJE121 into the existing Seiko/King Seiko official-source row.

Excluded from this batch:

- Monta Noble 40: no explicit lug-to-lug value found in the Worn & Wound article text.
- Citizen ATTESA Shades of Red Super Titanium: Worn & Wound gives case size and thickness but does not publish a discrete lug-to-lug value.

## 2026-06-28 Hodinkee Lug-To-Lug Batch

### Hodinkee

- Candidate scope checked: public Hodinkee sitemap article URLs were scanned until 86 article candidates containing `lug-to-lug` or equivalent text were captured for review.
- Added models: 22
- Existing models augmented with Hodinkee source notes: 4
- Official-source additions: 0
- Verified-external additions: 26
- Duplicate candidates skipped: 1
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 4

This batch records Hodinkee articles where the article text explicitly published lug-to-lug values and enough adjacent sizing data to populate the approved seed record. Where Hodinkee did not publish lug width, `lugWidthMm` is stored as `null` rather than inferred. Existing exact records were updated with Hodinkee source notes instead of duplicated.

Added references:

- Stowa Marine Original
- Obris Morgan Branco
- Sinn 103 St Sa E
- Halios Seaforth
- Oris ChronOris Date
- CWC 1980 Royal Navy Diver Re-Issue
- Panerai PAM00682
- William L. 1985 Automatic Chronograph
- Tudor Black Bay GMT M79830RB
- Aquadive Bathysphere 100 GMT
- Halios Seaforth GMT
- Yes Equilibrium
- Jaeger-LeCoultre Q3926480
- Casio A500WGA-9DF
- Maurice de Mauriac L2 Deep Blue Diver
- Meraud Bonaire Diver
- Citizen Tsuno Eco-Drive Chronograph Racer
- anOrdain Model 1
- Farer Eldridge
- Omega 311.92.44.30.01.001
- Cartier Santos-Dumont Small
- Cartier Santos-Dumont Large

Existing records augmented:

- Baltic Aquascaphe Classic Blue Gilt
- Unimatic Modello Tre U3
- Oak & Oscar Humboldt
- Richard Mille RM 12-01 Tourbillon

Skipped duplicate:

- Richard Mille RM 12-01 Tourbillon: existing seed record was retained and augmented with the Hodinkee source.

Excluded for source conflict or safer follow-up:

- Longines Avigation BigEye: existing seed value and Hodinkee review value differ materially for lug-to-lug, so no record was changed.
- NOMOS Tangente Neomatik 39 Silvercut: existing official-source dimensions are more specific than the rounded Hodinkee review value.
- Maen Hudson 38 Automatic: existing seed value and Hodinkee review value differ for lug-to-lug, so no record was changed.
- Unimatic Modello Uno U1-E/U1 variants: existing seed value and Hodinkee article family value differ enough to avoid a broad family overwrite.

## Cumulative totals

- Brands added: 34
- Models added: 262
- Official-source additions: 231
- Verified-external additions: 48
- Duplicate candidates skipped: 5
- Exact duplicate seed rows merged: 4
- Insufficient-information exclusions: 8
- Source-conflict exclusions: 15

## Modified files

- `data/watches.seed.json`
- `data/seed.sql`
- `data/l2l-expansion-report.md`
- `package.json`
- `scripts/generate-seed-sql.mjs`
- `scripts/watch-duplicate-candidates.mjs`
- `src/lib/seedData.test.ts`

## Verification

- `npm run deploy:check`: passed
  - Typecheck: 0 errors, 0 warnings, 0 hints
  - Tests: 12 files passed, 65 tests passed
  - Production build: passed
- `git diff --check`: passed
- Seed integrity checks:
  - Duplicate IDs: 0
  - Duplicate normalized `brand + model + reference + caseMm` keys: 0
  - Duplicate compact `reference + full dimensions` keys: 0
  - Missing or invalid source URLs: 0

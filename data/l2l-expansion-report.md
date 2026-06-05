# Lug-to-Lug Data Expansion Report

Updated: 2026-06-06

## Repository conventions

- Source data: `data/watches.seed.json`
- Units: millimeters
- Ordering: append-only by numeric `id`
- Duplicate key: normalized `brand + model + reference + caseMm`
- Source metadata: official or verification status is recorded in `sources[].note` because the current schema has no `sourceType` field.
- Optional fields that are not published are left as `null`; the schema was not changed.

## Completed batches

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

## Cumulative totals

- Brands added: 8
- Models added: 88
- Official-source additions: 88
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 7

## Modified files

- `data/watches.seed.json`
- `data/l2l-expansion-report.md`
- `src/lib/seedData.test.ts`

## Verification

- `npm run deploy:check`: passed
  - Typecheck: 0 errors, 0 warnings, 0 hints
  - Tests: 10 files passed, 35 tests passed
  - Production build: passed
- `git diff --check`: passed
- Seed integrity checks:
  - Duplicate IDs: 0
  - Duplicate normalized `brand + model + reference + caseMm` keys: 0
  - Missing or invalid source URLs: 0

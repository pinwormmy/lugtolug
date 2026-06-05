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

## Cumulative totals

- Brands added: 2
- Models added: 23
- Official-source additions: 23
- Verified-external additions: 0
- Duplicate candidates skipped: 0
- Insufficient-information exclusions: 0
- Source-conflict exclusions: 1

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

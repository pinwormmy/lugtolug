# Live Seed Audit

Date: 2026-06-11

## Scope

The production watch listing was compared against the local seed data before the expansion pass.

## Counts

| Source | Total | Patek Philippe | Rolex | Citizen |
| --- | ---: | ---: | ---: | ---: |
| Local seed before expansion | 1447 | 0 | 14 | 3 |
| Production site | 762 visible listing links | 1 | 16 | 3 |
| Local seed after expansion | 1489 | 20 | 16 | 23 |

## Production-Only Backfill

These production-only records were added to the seed source of truth:

| Brand | Model | Reference |
| --- | --- | --- |
| Patek Philippe | Nautilus 5811 White Gold | 5811/1G-001 |
| Rolex | Land-Dweller 36 | 127234 |
| Rolex | Land-Dweller 40 | 127334 |

## Notes

- The new Patek Philippe target is 20 total seed records, including the production backfill.
- The Citizen target is the original 3 seed records plus 20 new records.
- Some Patek Philippe and Citizen lug-to-lug values are explicitly marked in source notes as operator-maintained case-family values pending direct physical measurement sources. This keeps the data transparent now that trust scoring metadata is no longer stored.

# DOXA official catalog import report

## Full-catalog sweep (2026-07-15)

Audited the official `doxawatches.com` Shopify catalog and treated the second value in technical specifications such as `Diameter 45.00 mm x 47.00 mm` as case length/lug-to-lug.

Coverage and results:

- The product sitemap contains **341 product URLs**. Shopify's complete `collections/all` JSON also returned the same 341 handles.
- Filtering the complete catalog to products whose vendor/tag identifies a watch returned **122 watch product pages**, exactly matching the official `all-doxa-watches` collection. No watch page was omitted by collection discovery.
- **122/122 pages fetched successfully** with no request or parsing failures.
- **120 pages supplied a paired diameter value**, covering **291 unique official SKUs**.
- **264 new reference records added** and **27 existing exact-reference records updated** with official dimensions and source links. Existing `DOXA` capitalization was normalized to `Doxa` for the updated records.
- Official sources now cover 14 distinct dimension sets across the current catalog.

Official-source corrections applied:

- `840.80.031.15` (SUB 300T Clive Cussler): 42.5 × 44.5 mm, 13.65 mm height, 20 mm lug width. Previous secondary-source values were 42.5 × 45 mm and 13.4 mm height.
- `862.10.351.10` (SUB 600T Professional): 40 × 47.6 mm, 14.15 mm height, 20 mm lug width. Previous secondary-source values were 40 × 47 mm and 14.5 mm height with no lug width.

Two discontinued anniversary pages do not publish a second diameter value, so no unsupported lug-to-lug was inferred and their three SKUs were not imported:

- `sub-200-130th-anniversary-celebration` — official page states only 42 mm diameter.
- `sub-200-t-graph-18k-gold-130th-anniversary-celebration` — official page states only 43 mm diameter and 15 mm height.

The reusable importer is `scripts/import-doxa.mjs`. It refuses to write if any page request fails or if parsed dimensions are invalid, and it records the official product URL and interpretation rule on every imported reference.

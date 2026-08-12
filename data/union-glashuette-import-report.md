# Union Glashütte official catalog import report

## Full-catalog sweep (2026-08-12)

Audited the official international watch catalog at `union-glashuette.com/en_int/watches.html` and imported every product page that publishes a lug-to-lug value.

Coverage and results:

- The official catalog declared **72 products** across three listing pages.
- Catalog discovery found **72 unique official product URLs**, matching the declared count.
- **72/72 product pages fetched and parsed successfully**, with no request or parsing failures.
- **72 unique official references** were imported as new records; there were no exact-reference duplicates or existing-data conflicts.
- The import covers **26 official product titles** and **21 distinct dimension sets**.
- Published lug-to-lug values range from **39.39 mm to 53 mm**.
- Every imported record has an official product URL, reference, case diameter, lug-to-lug, and lug width.

The two Seris Date pages below do not publish case thickness. Their thickness remains `null`; no value was inferred:

- `D013.207.17.026.00` — 33 mm diameter, 39.39 mm lug-to-lug, 16 mm lug width.
- `D013.207.16.116.00` — 33 mm diameter, 39.39 mm lug-to-lug, 16 mm lug width.

The reusable importer is `scripts/import-union-glashuette.mjs`. It verifies the catalog's declared product count against discovered URLs and refuses to write if any request fails, any reference is duplicated, any page lacks case diameter or lug-to-lug, or parsed dimensions are invalid.

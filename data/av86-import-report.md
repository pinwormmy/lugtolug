# AV86 official product import

Date: 2026-07-11

## Brand identity and search

- Display brand: `AV86`, the current official name used by the manufacturer.
- Search aliases: `About Vintage` and `Skov Andersen`.
- The official AV86 story says that AV stands for About Vintage. Official product copy also uses the phrase “Skov Andersen collection”, supporting the regional alias.

## Import result

- Product URLs in the official Shopify sitemap: 162
- Fully verified watches imported: 41
- Exact SKU duplicates: 0
- Missing imported dimensions: 0
- Existing-data conflicts: 0
- Non-watch products identified and excluded: 72
- Product page conflicts excluded: 1
- Requests left unresolved after storefront throttling and browser-policy stop: 48

Every imported watch has an official AV86 product URL plus directly published case diameter, lug-to-lug, case thickness, lug width, and SKU. No missing value was inferred.

## Excluded conflict

`Danmark Det Officielle Landsholdsur, 1889 / DBU – 41mm` (`199500`) was excluded because the official page title says 41mm while its visible specification block says 36mm.

## Incomplete coverage

The storefront returned HTTP 429 during the catalog pass. A normal browser session recovered additional verified pages, but browser safety policy later stopped further AV86 navigation. The importer therefore wrote only the 41 completely verified records already collected. It did not bypass the block, accept partial page data, or infer measurements for unresolved products.

The resumable importer keeps request throttling at one request at a time and refuses a normal `--write` when any product request or source conflict remains. `--write-verified` is reserved for persisting the already verified subset while reporting every unresolved URL.

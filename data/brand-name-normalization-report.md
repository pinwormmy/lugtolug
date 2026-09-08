# Brand name normalization report

Date: 2026-09-08

## Why

Brand pages and watch URLs are keyed by `slugify(brand)`, so one brand stored
under several spellings was split across separate pages and counted as several
brands. The worst cases were NOMOS (`Nomos` 86, `NOMOS` 22, `NOMOS Glashütte`
17), Glashütte Original (`Glashutte Original` 51, `Glashütte Original` 29),
Jaeger-LeCoultre (`JLC` 25 Delugs rows next to 54 `Jaeger-LeCoultre` rows) and
Casio (`Casio`, `Casio G-Shock`, `G-Shock`, `Casio Vintage`).

## What changed

- Script: `scripts/normalize-brand-names.mjs` (`npm run data:normalize:brands`,
  `--apply` to write). The spelling map lives in the script so any choice can be
  flipped and re-applied.
- 345 records renamed across 43 spellings; the seed now has 518 brands instead
  of 559.
- 15 ex-`G-Shock` records received the `G-Shock` line prefix in `model` (and in
  `canonicalModel`) so they read like the existing Casio rows.
- 3 `NOMOS Glashütte` model groups were rekeyed from `nomos-glash-tte-…` to
  `nomos-…`.
- 4 curated names: 1600 `Tangente 38`, 1601 `Tangente 38 Date`, 1763 `Vintage
  Back to the Future 40th Anniversary`, 2910 `La Rochelaise`.
- 9 duplicates that only existed because of the spelling split were merged into
  the canonical record (sources transferred, canonical dimensions kept), and the
  duplicate ids were added to `D1_ARCHIVED_WATCH_IDS`: 3024, 4422, 4424, 4431,
  4433, 4630, 4638, 6128, 7099. The seed went from 7,421 to 7,412 records.
- `data/brand-search-aliases.json` keeps the retired spellings searchable:
  `NOMOS Glashütte`, `JLC`, `Bvlgari`, `Venustas Per Constantiam`.
- `scripts/audit-seed-data.mjs` now fails when one brand identity (diacritics,
  case, punctuation and `Watch Co.` suffixes folded) is stored under more than
  one spelling, so a future import cannot reintroduce a split.

## Spelling decisions

| Stored as | Now | Records | Note |
| --- | --- | ---: | --- |
| Nomos, NOMOS Glashütte | NOMOS | 103 | Brand's own styling; keeps the `nomos` slug of the majority |
| Glashutte Original | Glashütte Original | 51 | Matches the existing `Union Glashütte` / `Mühle Glashütte` convention |
| JLC | Jaeger-LeCoultre | 25 | Delugs abbreviation |
| Casio G-Shock, G-Shock, Casio Vintage | Casio | 22 | Product lines, kept in `model` |
| Hermes | Hermès | 9 | Official spelling |
| Anordain | anOrdain | 54 | Brand's own styling; same slug |
| H. Moser & Cie | H. Moser & Cie. | 34 | Official spelling; same slug |
| Bvlgari, Universal Geneve, Girard Perregaux, Gérald Charles, Speake Marin | Bulgari, Universal Genève, Girard-Perregaux, Gerald Charles, Speake-Marin | 6 | Official spellings |
| MING, YEMA, TITONI, CVSTOS, AWAKE, LIP, Meistersinger, echo/neutra | Ming, Yema, Titoni, Cvstos, Awake, Lip, MeisterSinger, Echo/Neutra | 13 | Editorial styling, majority spelling |
| Jacob & Co, Habring2, Astor+Banks, Meraud | Jacob & Co., Habring², Astor + Banks, Méraud | 7 | Official spellings |
| Isotope Watches, Cornell Watch Company, Bangalore Watch Co., Balmont Watches, Haim Watch Company, Reservoir Watches, Brew Watch Co., Boldr Supply Co. | Isotope, Cornell Watch Co., Bangalore Watch Company, Balmont, Haim, Reservoir, Brew, Boldr | 13 | Suffix variants of one maker |
| Merci | Merci Instruments | 1 | Watch line of the Paris store |
| Venustas Per Constantiam, Venustas Per Constantiam – VPC | VPC | 2 | Brand's short form; alias keeps the long form searchable |
| Le Forban, Le Forban Securite Mer | Le Forban Sécurité Mer | 2 | Official spelling |
| Monochrome x Habring², Brew Watch Co. x Worn & Wound | Habring² x Monochrome, Brew x Worn & Wound | 2 | Same collaboration, one label |
| Ōtsuka Lōtec | Otsuka Lotec | 1 | Kept ASCII because `slugify` would drop the leading macron letter |

Collaboration labels other than the two above were left alone.

## URL impact

145 records moved to a new brand slug, so their detail URLs and brand pages
changed. The largest moves are `glashutte-original` → `glash-tte-original` (51),
`jlc` → `jaeger-lecoultre` (21), `casio-g-shock` → `casio` (20),
`nomos-glash-tte` → `nomos` (17) and `hermes` → `herm-s` (9). No redirects were
added; the old URLs return 404 after deployment, so run `npm run seo:indexnow`
for the new brand pages after the next deploy.

## Follow-up: slug transliteration

`slugify` replaces accented letters with `-`, which is why the merged
Glashütte Original and Hermès pages now sit at `glash-tte-original` and
`herm-s`. Transliterating diacritics in `slugify` would fix those and 22 other
brand slugs (224 records, e.g. `union-glash-tte` → `union-glashutte`) plus 250
model slugs, all of which are live URLs today. That is an SEO decision that
needs `_redirects` rules for the old paths, so it was deliberately not bundled
with this data change.

## Production D1

The brand rename is a plain upsert of the changed rows plus the archive list:

```sh
npm run data:seed-delta-sql -- --base-ref=<commit before this change>
```

The generator writes a `retired-001.sql` chunk that archives the nine merged
ids, followed by the watch and source chunks; apply them in that order.

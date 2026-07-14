# Variant grouping & dedup report

2026-07-14 sweep over data/watches.seed.json (post-IntoWatch import, 5,774 rows).

## Method

Candidates were same-brand rows with identical published dimensions (lug-to-lug, case, thickness, lug width) whose references share a compact 7-character prefix — i.e. rows that differ only in dial/bezel color, band configuration, or edition branding (품번 앞자리 동일). 198 candidate groups (759 rows) were reviewed one by one against the rule: group only when collection, generation, case size, case material, and complication all match; anything mixing case materials (steel/bronze/gold/ceramic/titanium/PVD), complications (small seconds vs power reserve, chrono vs three-hand, GMT), generations, or destro crowns was left ungrouped. 64 of 198 groups were skipped on those grounds.

## Results

- **469 rows newly assigned a modelGroup** across 124 variant families (28 rows already carried the same group and were only re-confirmed/labelled).
- **2 duplicate rows merged and retired** (delugs import artifacts where the second copy carried a ".1" reference suffix); their sources were folded into the surviving rows and the ids added to RETIRED_WATCH_IDS:
  - id 3105 (Andreas Strehler Sauterelle à Lune Perpétuelle, ref `Sauterelle à Lune Perpétuelle.1`) → merged into id 3099 (ref `Sauterelle à Lune Perpétuelle`)
  - id 3100 (Andreas Strehler Sauterelle à Heure Mondiale, ref `Sauterelle à heure mondiale.1`) → merged into id 3104 (ref `Sauterelle à heure mondiale`)
- **2 pre-existing mis-assignments fixed** (plus the true sibling of the first, re-homed with it):
  - id 3294 (Bell & Ross `BR0392-D-BL-ST-SRB`): bell-and-ross-br-03-94-black-matte → bell-and-ross-br-03-92-diver
  - id 3310 (Bell & Ross `BR0392-D-BU-ST-SRB`): (none) → bell-and-ross-br-03-92-diver
  - id 1997 (Norqain `N2201.19S01.C01.R01`): norqain-freedom-60-43mm-off-white → norqain-freedom-chrono-40mm
- No exact reference duplicates existed (brand + compact reference is unique across all rows both before and after).
- URL slugs (brand/model/reference) are untouched: grouping is display/search metadata only, so no live URLs move.

## Rows grouped per brand

- Ball: 77
- Norqain: 77
- Doxa: 41
- Anordain: 39
- Formex: 29
- Christopher Ward: 26
- Zelos: 19
- Louis Erard: 16
- Tissot: 16
- Bremont: 13
- Fears: 12
- Nodus: 12
- Borealis: 11
- Breitling: 10
- Farer: 10
- Prometheus: 10
- Omega: 9
- Bell & Ross: 7
- Atelier Wen: 5
- Carl F. Bucherer: 5
- Casio: 5
- Marathon: 5
- Ulysse Nardin: 5
- Gronefeld: 4
- Mühle Glashütte: 4
- Oris: 4
- Unimatic: 4
- Arken: 3
- Cartier: 3
- Blancpain x Swatch: 2
- Delma: 2
- Lorier: 2
- Omega x Swatch: 2
- Squale: 2
- Swatch: 2
- Vaer: 2
- Venturo: 2

## Variant families (modelGroup → members)

- `anordain-fabrik-model-1` (3): 3155 Off-white; 3163 Salmon; 3167 Blue
- `anordain-model-1-large` (4): 3152 Japanese Oxblood; 3154 Iron Cream; 3160 Teal; 3164 Parisian Blue
- `anordain-model-1-medium` (8): 3136 Plum Fumé; 3137 Teal; 3138 Blue Fumé; 3139 Iron Cream; 3141 Paynes Grey; 3143 Parisian Blue; 3144 Japanese Oxblood; 3145 Green Fumé
- `anordain-model-1-small` (4): 3148 Iron Cream; 3149 Japanese Oxblood; 3150 Parisian Blue; 3151 Teal
- `anordain-model-2-large` (4): 3156 White; 3158 Grey Haar; 3161 Racing Green; 3165 Flax
- `anordain-model-2-medium` (14): 3119 Midnight Green; 3133 Moss Green; 3120 Grey; 3132 Green Fumé; 3121 Turquoise Fumé; 3127 Torr Blue; 3124 Purple; 3130 Purple Fumé; 3125 Brown Fumé; 3134 Blue Fumé; 3140 White; 3142 Grey Haar; 3146 Racing Green; 3147 Flax
- `anordain-model-3-method` (2): 3122 Aqua; 3126 Lichen
- `arken-alterum` (3): 2742; 2845 Year of the Dragon; 5073 Sage Grey
- `atelier-wen-porcelain-odyssey` (5): 3217 Hao; 3221 Ji; 3222 Hao Green Edition; 3223 Hao Red Edition; 3224 Hao Purple Edition
- `ball-engineer-hydrocarbon-aerogmt-ii` (7): 5122 Patriot Meteorite; 5123 Patriot Blue; 5134 Meteorite dial; 5144 Meteorite/black; 5149 Meteorite dial; 5150 Meteorite dial; 5309 Blue dial
- `ball-engineer-ii-m-skindiver-heritage` (3): 1664 Black dial, bracelet; 5185 Black dial, strap; 5298 Black dial, strap
- `ball-engineer-iii-marvelight-40mm` (5): 5145 Meteorite dial; 5156 Turquoise dial; 5158 Red dial; 5206 Orange dial; 5219 Silver dial
- `ball-engineer-iii-pioneer-ii` (2): 5178 Blue dial (IBE); 5179 Black/red dial (BKR)
- `ball-engineer-iii-pioneer-ii-36mm` (2): 5180 Ice blue dial; 5181 Black/red dial
- `ball-engineer-iii-pioneer-ii-43mm` (2): 5176 Ice blue dial; 5177 Black/red dial
- `ball-engineer-m-marvelight-43mm` (3): 5108 Patriot Blue; 5109 Patriot Meteorite; 5297 Grey dial
- `ball-engineer-m-pioneer-40mm` (3): 5250 Black dial; 5251 Blue dial; 5252 Green dial
- `ball-engineer-m-skindiver-iii` (2): 5165 Blue dial; 5233 Beyond edition, blue dial
- `ball-engineer-master-ii-diver-chronometer` (6): 5201 Brown dial, strap; 5202 Brown dial, bracelet; 5240 Blue dial, strap; 5241 Black dial, strap; 5242 Blue dial, bracelet; 5243 Black dial, bracelet
- `ball-fireman-victory` (3): 5112 Ice blue dial; 5142 White MOP dial; 5290 Silver dial
- `ball-roadmaster-marine-gmt` (5): 5127 Meteorite dial; 5128 White dial; 5168 Meteorite dial; 5169 Green dial; 5183 Silver dial
- `ball-roadmaster-marine-gmt-moon-phase` (7): 5118 Meteorite dial; 5119 Blue dial; 5125 Meteorite dial; 5126 White dial; 5166 Meteorite dial; 5167 Green dial; 5182 Silver dial
- `ball-roadmaster-pilot-gmt` (11): 5160 Meteorite dial; 5196 Black dial (S7CJ); 5208 Black dial (S5CJ); 5212 Black dial (S4C); 5228 Black dial (S3C); 5259 White dial (S2C); 5260 Blue dial (S2C); 5261 Black dial (S2C); 5268 White dial (S1C); 5269 Blue dial (S1C); 5270 Black dial (S1C)
- `ball-roadmaster-rescue-chronograph` (8): 5148 White dial; 5193 Ice blue dial; 5234 White/black panda; 5235 Black/white panda; 5248 Blue dial; 5249 White dial; 5266 Blue dial; 5267 Black dial
- `ball-roadmaster-starlight-bronze` (2): 5318 Brown dial; 5319 Blue dial
- `ball-roadmaster-worldtime` (6): 5310 Black/red dial; 5311 Black/blue dial; 5312 Black dial; 5313 Black/red dial (COSC); 5314 Black/blue dial (COSC); 5315 Black dial (COSC)
- `bell-and-ross-br-01` (5): 3290 Aviation Limited Edition; 3299 Instrument de Marine; 3302; 3305; 3306 Aviation Instrument Limited Edition
- `bell-and-ross-br-03-classic-steel` (2): 3279 Black dial; 3285 Blue dial
- `blancpain-x-swatch-scuba-fifty-fathoms` (2): 2880 Ocean of Storms; 2897
- `borealis-adraga-steel` (4): 5694 2AA dial; 5695 2AB dial; 5696 2BB dial; 5698 2BC dial
- `borealis-navale` (2): 5690 Blue dial, no date; 5691 Black dial, date
- `borealis-olisipo` (3): 5716 Black dial; 5717 Blue dial; 5718 Green dial
- `borealis-scorpionfish-v2` (2): 5692 Date; 5693 No date
- `breitling-chronomat-automatic-36` (2): 3561; 3577 Victoria Beckham
- `breitling-chronomat-b01-42-six-nations` (6): 3456 Ireland; 3484 England; 3516 Scotland; 3570 Italy; 3572 France; 3578 Wales
- `breitling-superocean-heritage-chronograph-44` (2): 3447 Green dial; 3462 Ocean Conservancy
- `bremont-supermarine-300m` (3): 3641 No date; 3644 Green, no date; 3647 Date
- `bremont-supermarine-300m-gmt` (3): 3642 Glacier Blue; 3643 Tundra Green; 3650 Ember Red
- `bremont-supermarine-full-ceramic` (2): 3645 Tactical Black; 3649 Jungle Green
- `bremont-terra-nova-38` (3): 3653; 3667 White dial; 3670 Pink dial
- `bremont-terra-nova-40-5-date` (2): 3672; 3666 Black dial
- `carl-f-bucherer-patravi-scubatec` (5): 3682; 3685 Verde; 3692 Maldives; 3688 Black; 3690 Black Manta Special Edition
- `cartier-santos-de-cartier-large` (3): 3700; 3707; 3698 ADLC
- `casio-g-shock-mr-g-mrg-b2100` (3): 1235; 2732; 2757
- `casio-g-shock-mudmaster-gg-b100` (2): 2276; 2277
- `christopher-ward-bel-canto-c1` (2): 3885 Classic; 4010 Skeletonised Openwork
- `christopher-ward-dune-c65-aquitaine` (2): 3870 Green dial; 3986 Blue dial
- `christopher-ward-the-twelve-660` (8): 3794 White dial, bracelet; 5358 Blue dial, bracelet; 5359 Blue dial, rubber; 5360 Bracelet; 5361 Rubber strap; 5362 White dial, rubber; 5363 Black dial, bracelet; 5364 Black dial, rubber
- `christopher-ward-the-twelve-c12-titanium` (5): 3800; 3815; 3836; 3854; 3891
- `christopher-ward-trident-c60-pro-300` (9): 3796; 3811; 3823; 3834; 3856; 3866; 3895; 3900; 3961
- `delma-midland` (2): 2801; 2715 Purple dial
- `doxa-sub-1500t` (7): 4040 Sharkhunter; 4042 Professional; 4052 Searambler; 4053 Whitepearl; 4063 Aquamarine; 4064 Divingstar; 4065 Caribbean
- `doxa-sub-200` (2): 4024 Sharkhunter; 4038 Searambler
- `doxa-sub-200-c-graph` (5): 4048 Sharkhunter; 4054 Searambler; 4056 Aquamarine; 4060 Professional; 4067 Divingstar
- `doxa-sub-200-c-graph-ii` (6): 4035 Caribbean; 4044 Whitepearl; 4049 Sharkhunter; 4057 Aquamarine; 4059 Professional; 4066 Divingstar
- `doxa-sub-300` (2): 4036 Sharkhunter; 4046 Searambler
- `doxa-sub-300-beta` (6): 4039 Searambler; 4047 Professional; 4050 Aquamarine; 4051 Divingstar; 4068 Caribbean; 4071 Sharkhunter
- `doxa-sub-300-carbon` (6): 4069 Whitepearl; 4070 Sharkhunter; 4072 Professional; 4073 Caribbean; 4074 Divingstar; 4075 Aquamarine
- `doxa-sub-300t` (7): 4022 Professional; 4026 Sharkhunter; 4030 Divingstar; 4031 Aquamarine; 4032 Whitepearl; 4033 Caribbean; 4037 Searambler
- `farer-bradfield-pilot` (2): 4147; 4162 Blue
- `farer-endeavour-aqua-compressor-titanium-series-iii` (2): 4112; 4117 Ocean Blue
- `farer-mansfield-cushion-case` (2): 4123 Midnight; 4125
- `farer-portobello-limited-edition-chronograph` (2): 4166; 4168 Black
- `farer-resolute-36mm` (2): 4124; 4157 Sorbet
- `fears-brunswick-40` (5): 4171 Odyssey Edition; 4173 Flamingo Pink; 4176 Aurora; 4178 Copper Salmon; 4180 Boutique Edition
- `fears-brunswick-40-5-jump-hour` (2): 4175 Raven Black; 4179 Coral Lacquer
- `fears-redcliff-39-5` (5): 4172 Pewter Grey; 4174 Raven Black; 4181 Burlingame Edition Confetti; 4182 Boutique Edition; 4183 Cherry Red
- `formex-aria` (2): 2285 Ardesia Grey; 2287 Selva Green
- `formex-essence-ceramica-cosc` (4): 2288 Blue; 2319 Arctic White; 2320 Dégradé; 2321 Gamaret
- `formex-essence-ceramica-skeleton-cosc` (4): 2290 Stradale; 2322 GT; 2323 Stradale Blue; 2324 Stradale Viola
- `formex-essence-fortyone-automatic-chronometer` (2): 1533 Dégradé Brown; 1534 Gamaret Red
- `formex-essence-fortythree-automatic-chronometer` (2): 1283 Black; 2325 Green
- `formex-essence-leggera-fortyone-automatic-chronometer` (2): 2291 Cool Grey; 2326 Electric Blue
- `formex-essence-thirtynine-automatic-chronometer` (3): 2292 Blue Agate; 2293 Mother of Sky; 2329 White
- `formex-field-automatic-40mm` (5): 2330 Basalt Grey, nylon-velcro; 2331 Coho Salmon, khaki nylon-velcro; 2332 Deep Blue, leather strap; 2333 Golden Honey, khaki nylon-velcro; 2334 Ice Blue, blue nylon-velcro
- `formex-reef-42mm-automatic-cosc-300m` (5): 1281 Blue; 1536 Silver dial, steel bezel; 2337; 2338; 2339 Bronze dial
- `gronefeld-1941-principia` (4): 4358 Salmon dial; 4359 Turquoise dial; 4361 Rhodium dial; 4362 Cream Lacquer dial
- `lorier-hyperion-series-ii` (2): 1348; 1350 Skyward
- `louis-erard-2300-sport-chronograph-44mm` (3): 1542 Blue; 1543 Green; 1544 Rainbow Black
- `louis-erard-2340-40mm` (2): 1550 Forest Green; 1551 Mauve
- `louis-erard-excellence-petite-seconde-39mm` (3): 1546 Aventurine; 1548 Lapis Lazuli; 1549 Malachite
- `louis-erard-le-regulateur-cedric-johner` (2): 4549 Blue; 4552 Mauve
- `louis-erard-le-regulateur-metiers-d-art-grave` (2): 4547 Gravé Noir; 4550 Gravé Bleu
- `louis-erard-x-kudoke-le-regulateur-42mm` (4): 1552 Forest Green; 1553 Light Blue; 4546 White Mother of Pearl; 4548 Purple
- `m-hle-glash-tte-panova-40mm` (4): 1582 Lime Green, leather strap; 1583 Lime Green, Milanaise bracelet; 1586 Violet, leather strap; 1587 Violet, Milanaise bracelet
- `marathon-ssnav-d-arctic-edition-41mm` (3): 1561 Nylon Defense Standard Strap; 1562 Rubber Strap; 1564 Black dial
- `marathon-ssnav-d-quartz-41mm` (2): 1563 Arctic White; 1565 Blue Yonder LE
- `nodus-canyon` (2): 4624 Forest Green; 4625 Night Sky
- `nodus-contrail-gmt` (4): 4612 Terra Lux; 4618 Impulse; 4620 Polaris; 4623 Laguna
- `nodus-duality-ii` (4): 1320 Chasm Black; 1323 Drift Blue; 4613 Unity White; 4615
- `nodus-trailtrekker` (2): 4619 Clay; 4621 A.C.T.
- `norqain-adventure-37mm` (19): 5548 White dial, rubber (R03); 5549 White dial, bracelet (S02); 5550 White dial, rubber (R01); 5551 White dial, strap (V01); 5557 Green dial, rubber (R01); 5558 Green dial, bracelet (S02); 5559 White dial (08S08), rubber (R04); 5560 White dial (08S08), rubber (R03); 5561 White dial (08S08), bracelet (S01); 5562 White dial (08S08), rubber (R01); 5563 White dial (08S08), strap (V01); 5564 P01 dial, bracelet (S01); 5586 E01 dial, bracelet (S01); 5587 E01 dial, rubber (R01); 5588 E01 dial, rubber (R02); 5589 E01 dial, strap (V01); 5597 P01 dial (08S11), bracelet (S01); 5598 P01 dial (08S11), rubber (R01); 5629 Swiss Football National Team LE, rubber
- `norqain-adventure-40mm` (4): 5654 G01 dial, bracelet (S01); 5655 G01 dial, rubber (R01); 5656 E01 dial, rubber (R01); 5657 E01 dial, bracelet (S01)
- `norqain-adventure-chrono-44mm` (5): 5552 Rubber strap (R01); 5553 Rubber strap (R02); 5554 Fabric strap (F03); 5555 Fabric strap (F01); 5556
- `norqain-freedom-60-43mm-off-white` (3): 1996 Alcantara strap; 1998 steel bracelet; 5636 Rubber strap
- `norqain-freedom-chrono-40mm` (13): 5625 Ice Cream, bracelet (S01); 5626 Ice Cream, rubber (R02); 5627 Ice Cream, leather (L01); 5628 Ice Cream, leather (L02); 5660 Sprinkles (A01), bracelet; 5661 Sprinkles (A01), rubber; 5662 Sprinkles (K01), bracelet; 5663 Sprinkles (K01), rubber; 5664 Zermatt Unplugged, bracelet; 5665 Zermatt Unplugged, textile (T01); 5666 Zermatt Unplugged, textile (T02); 5667 Zermatt Unplugged, rubber (R01); 5668 Zermatt Unplugged, rubber (R02)
- `norqain-independence-skeleton-chrono-42mm` (4): 5599 B01 dial, rubber (R01); 5600 B01 dial, bracelet (S01); 5637 O01 dial, rubber (R01); 5638 O01 dial, bracelet (S01)
- `norqain-wild-one-42mm` (4): 5580 Rubber strap (R02); 5581 Rubber strap (R03); 5582 Rubber strap (R01); 5583 Rubber strap (R04)
- `norqain-wild-one-skeleton-39mm` (14): 5608 B03 colorway, rubber (R01); 5609 B03 colorway, rubber (R03); 5610 B03 colorway, rubber (R02); 5611 B03 colorway, rubber (R04); 5612 Limited Edition, rubber (R01); 5613 Limited Edition, rubber (R03); 5614 Limited Edition, rubber (R02); 5615 Limited Edition, rubber (R04); 5616 B02 colorway, rubber (R01); 5617 B02 colorway, rubber (R03); 5618 B02 colorway, rubber (R02); 5619 B02 colorway, rubber (R04); 5620 P01 colorway, rubber (R01); 5621 P01 colorway, rubber (R02)
- `norqain-wild-one-skeleton-42mm` (11): 5584 B07 colorway, rubber (R01); 5585 B07 colorway, rubber (R02); 5590 Generali Genève Marathon edition; 5591 B13 colorway, rubber (R01); 5592 B13 colorway, rubber (R02); 5593 B14 colorway, rubber (R01); 5594 B14 colorway, rubber (R02); 5603 B18 colorway, rubber (R01); 5604 B18 colorway, rubber (R02); 5646 Spengler Cup LE, rubber (R01); 5647 Spengler Cup LE, rubber (R02)
- `omega-de-ville-prestige-co-axial-master-chronometer-small-seconds-41mm` (6): 175 Blue dial, leather strap; 177 Green dial, leather strap; 190 Silver dial, leather strap; 172 Blue dial, bracelet; 173 Silver dial, bracelet; 178 Green dial, bracelet
- `omega-seamaster-aqua-terra-150m-co-axial-master-chronometer-38mm` (3): 196 Blue dial; 232; 261
- `omega-x-swatch-moonswatch-mission-to-the-moonphase` (2): 2834 New Moon; 2840
- `oris-big-crown-pointer-date-40mm` (2): 1605 Purple dial; 1606 Yellow dial
- `oris-big-crown-pointer-date-caliber-403-40mm` (2): 1607 Green dial; 1608 Terracotta Pink dial
- `prometheus-eagle-ray-4` (3): 5522 4D.1; 5523 4C; 5524 4A.1
- `prometheus-zenobia` (7): 5515 Blue Date; 5516 Black Date; 5517 Meteorite Non-Date; 5518 Orange Non-Date; 5519 Orange Date; 5520 Yellow Date; 5521 Green Date
- `squale-matic-44mm` (2): 1631 Black and Satin Orange; 1632 Blue
- `swatch-moonswatch` (2): 4931 Mission to the MoonPhase; 4933 Mission to Earthphase Moonshine Gold
- `tissot-prx-powermatic-80-40mm` (10): 854 Blue dial; 2476 Black dial; 2477; 2478 Ice blue dial; 2480 Green dial; 2481 Blue dial, leather strap; 2482 Black dial, leather strap; 2484 Black dial, rubber strap; 2197 UFO Robot Grendizer Special Edition; 2198 Ice blue dial
- `tissot-seastar-1000-powermatic-80-40mm` (2): 2506; 2538 Wilson WNBA Special Edition
- `tissot-seastar-1000-quartz-40mm` (4): 2511 Blue dial; 2512 Black dial; 2513; 2537 Wilson WNBA Special Edition
- `ulysse-nardin-diver-44mm` (3): 4986; 4991 Beau Lake Limited Edition; 4993 One More Wave Limited Edition
- `ulysse-nardin-diver-x-skeleton` (2): 4984 Azure; 4994
- `unimatic-modello-due` (2): 5504 U2-AB; 5505 U2-AG
- `unimatic-modello-uno` (2): 5506 U1-B; 5507 U1-A
- `vaer-a5-atlas` (2): 1292 Black; 3017
- `venturo-field-watch-1` (2): 5678 Cream; 5679 SWAG LE
- `zelos-eagle-2-ti` (5): 5024 Arctic; 5026 Carbon; 5027 Meteorite; 5030 Teal; 5036 Aventurine
- `zelos-mako-300m-diver` (2): 5004 Falcons Eye; 5012 Lagoon Blue
- `zelos-spearfish-dual-time` (4): 5013 Sky Blue; 5019 Meteorite; 5020 Spark; 5034 Ocean Blue
- `zelos-swordfish-40mm-ss` (2): 5008 Teal MOP; 5010 Crimson Red
- `zelos-swordfish-42mm-ti` (3): 5005 Carbon; 5014 Blood Moon; 5029 Sakura
- `zelos-swordfish-field-38mm-ss` (3): 5007 Stonewash; 5017 Frost; 5033 Nebula

## Skipped groups (kept separate on purpose)

- group 0: Epurato Steel vs Epurato Bronze — different case material
- group 11: Model 1 Precious Metal in black rhodium vs white gold vs red gold — case material differs
- group 21: Snoopy Flying Ace vs Doolittle Raiders — two distinct limited editions, unclear if identical config
- group 23: CSAR vs First Responder Rotor-LOCK — distinct named editions, uncertain beyond dial branding
- group 24: CSAR vs First Responder — distinct named editions, uncertain beyond dial branding
- group 27: Engineer II Galloping Horse vs Engineer III Legend Arabic — different generation/line names
- group 32: Spacemaster II vs Submarine Warfare — two distinct Hydrocarbon limited editions
- group 33: Normandy vs Endurance 1917 are distinct limited editions; cannot confirm identical case material/finish (Endurance 1917 may be titanium).
- group 34: Star Magna vs Best Bronze — Best Bronze is a bronze case, Star Magna material unconfirmed; possible material mismatch.
- group 35: DeepQUEST II vs DeepQUEST Ceramic are different generations/case constructions of the line.
- group 37: Marvelight Chronometer vs Dreamer are different Engineer III sub-models (different dial technology/positioning), not mere colorways.
- group 40: Archangel vs Challenger are different Roadmaster sub-lines despite shared base ref; likely bezel/handset differences beyond colorway.
- group 41: Doolittle Raiders vs Endurance 1917 are distinct limited editions; case finish/material parity unconfirmed.
- group 43: Trainmaster Titanium vs MSF Humanity edition — cannot confirm the LE shares the titanium case (S-prefix bracelet segment suggests possible steel).
- group 44: Engineer III King vs Dreamer TiC — TiC implies titanium-carbide coated case, different finish/sub-model.
- group 46: Mixed models: GMT (complication), Bronze (material), Classic — no two rows form a valid same-case group.
- group 47: Hermetique Tourer steel vs Bronze — case material differs.
- group 49: Only viable pair (3294+3310, steel BR 03-92 Diver) is blocked: 3294 already carries modelGroup bell-and-ross-br-03-94-black-matte, which is a mislabel (BR0392-D Diver ref grouped under the 03-94 chronograph); extending it would worsen the corruption. Bronze rows differ in material.
- group 52: 3403 is NT42CHSS (steel) while the existing bomberg-apex-pulse rows are NT42CHSP (plated/coated case) — case finish differs and site data shows no precedent for mixing SS/SP; grouped rows already grouped.
- group 53: Ungrouped 3399 is NT42CHSP (plated) while existing bomberg-apex members are all NT42CHSS (steel); case coating differs, no site precedent for mixing.
- group 58: Super Avenger B01 46 standard vs Night Mission — Night Mission uses DLC/black case finish, different case treatment.
- group 59: Avenger GMT 44 vs Night Mission — Night Mission editions normally use black DLC titanium; steel-prefixed ref on the LE row is suspicious, cannot confirm same case finish.
- group 67: Jimmy Chin rows already grouped; remaining chronograph rows differ in case material (steel vs bronze vs rose gold)
- group 72: GMC-B2100ZE-1A edition finish/coating unverifiable vs GMC-B2100D-1A steel; uncertain
- group 74: C041.407.19 vs C041.407.39: Black Edition is a coated/PVD case per Tissot-style Certina coding; coating-color difference, no site precedent
- group 78: Trident Reef is a different model line from Lumiere despite shared case code; Lumiere rows already correctly grouped
- group 79: Sandhurst Series 2 and Cranwell Series 2 are distinct model lines with separate existing modelGroups
- group 82: Valour and The Goodison are distinct special editions with separate existing modelGroups
- group 83: All rows already correctly grouped under their Sandhurst/Cranwell Series 2 modelGroups
- group 93: Aristera is the destro (left-crown) version vs standard crown; rubric requires skip
- group 94: Chronometre Optimum is a different movement/model; Havana vs Nacre CS editions likely differ in case metal (red gold vs platinum)
- group 95: Automatique vs Automatique Lune differ in complication (moonphase); Lune editions may differ in case metal
- group 96: Chronometre Bleu Byblos (tantalum) and Holland & Holland (steel) are distinct limited models with different case materials
- group 97: Two different gem-set Tourbillon Souverain editions; case material/setting differences uncertain
- group 98: Centigraphe Anniversaire is a distinct limited edition likely differing in case metal from Centigraphe Souverain
- group 99: FPJ Octa Lune Havana/Nacre come in platinum and rose gold; case material of each row unknowable from data
- group 103: Discovery II vs Discovery Olive (68h power reserve) may span generations; cannot confirm same case/movement
- group 109: Brunswick Pt (platinum) vs Brunswick Au (gold) are different case materials
- group 120: Gruppo Gamma Divemaster DG codes may encode case material (steel vs bronze); cannot verify
- group 121: Gruppo Gamma Vanguard AN codes may encode case material (bronze/brass line); cannot verify
- group 122: Hydrium X collab series vs base Hydrium; series relationship to base case unverified
- group 123: Titanium Diver GMT vs Black Widow (likely steel) differ in case material
- group 124: Lorier Hydra Zulu is the GMT/dual-time version vs three-hand Hydra III — complication differs
- group 135: Ming 18.01 H41 vs H41 DLC — DLC is a different case coating/finish, not a colorway variant
- group 138: Mixed lines: Sector Deep Pioneer vs Sector Deep Destro (destro crown) — rubric says different model lines and destro must not group; Pioneer generic row vs Admiral colorway not a certain duplicate
- group 139: Sector II Sport vs Field Titanium vs Pilot DLC — different model lines, plus titanium and DLC case differences
- group 141: Mix of Sector II GMT and Sector II Pilot (different complication); Pilot Phantom likely DLC case; Phantom vs Phantom-Black rows not certainly the same product
- group 155: NTH — no existing NTH modelGroup in seed, rubric says skip NTH absent prior convention (also mixes Scorpène vs Scorpène Nomad colorway lines)
- group 156: NTH Näcken Modern date/no-date/colors — no existing NTH modelGroup convention, skip per rubric
- group 157: NTH Skipjack Date vs Non-Date would otherwise qualify, but rubric says skip NTH when no rows carry an NTH modelGroup (none do in seed)
- group 158: NTH Barracuda Vintage Black date/no-date — skip per NTH rule (no existing modelGroup convention)
- group 161: 434.20 two-tone rows are one Power Reserve + one Small Seconds — different complications, nothing to group
- group 162: 434.23 two-tone rows are one Power Reserve + one Small Seconds — different complications
- group 163: 434.53 gold: Omega reuses BB=53 across gold alloys (dial 02 vs 10 likely Sedna vs Moonshine gold cases), so the PR pair may differ in case material — uncertain
- group 165: Five rows already share the AT 41mm modelGroup; only ungrouped row (225) is Small Seconds - different complication, must stay separate
- group 166: Railmaster three-hand vs Small Seconds - different complication; only one row would remain
- group 167: Railmaster three-hand vs Small Seconds - different complication; only one row would remain
- group 168: Racing rows already grouped; ungrouped row (417) is Super Racing (Spirate, cal 9920) - a distinct model
- group 174: Chronometre Artisans Subscription vs Titanium are different editions with possibly different case execution - uncertain
- group 185: Patrimony 85180/000R is rose gold, Ora ito 85180/000J is yellow gold - case material differs
- group 194: Starfighter Chronograph vs ZircTi LE - case material likely differs and rows may even be the same product; not certain either way
- group 195: Defy Skyline Black Ceramic vs Skyline Skeleton - skeleton is a distinct dial/model line
- group 196: A384 Revival vs /3817 dial-coded row (likely A3817) - different named revival models
- group 197: A385 Revival vs Chronomaster 50th Anniversary (A384-style silver dial) - different named revival models

## Pass 2 (2026-07-14) — null-dimension fills and NTH grouping

### Missing dimensions filled from sibling records (50 values)

Rows inside a curated modelGroup family that displayed apart from their siblings only because a metric was null. Each fill required every complete sibling matching the row on all mutually known metrics to agree on one value; a source entry citing the donor record was appended to the filled row. One conflicting case was refused (Bel Canto C1 Moonphase id 3944: donors disagree 13.3 vs 12.9 mm).

- id 4309 (Grand Seiko Sport Collection Caliber 9S 25Th Anniversary Limited Edition): thickness = 14.4 mm ← sibling id 103 `SBGJ237`
- id 4342 (Grand Seiko Sport Collection): thickness = 14.4 mm ← sibling id 103 `SBGJ237`
- id 4282 (Grand Seiko Evolution 9 Collection): thickness = 11.7 mm ← sibling id 126 `SLGH005`
- id 4333 (Grand Seiko Evolution 9 Grand Seiko 60th Anniversary): thickness = 11.7 mm ← sibling id 126 `SLGH005`
- id 2197 (Tissot PRX 40mm UFO Robot Grendizer Special Edition): lugWidth = 12 mm ← sibling id 854 `T137.407.11.041.00`
- id 2198 (Tissot PRX Powermatic 80): lugWidth = 12 mm ← sibling id 854 `T137.407.11.041.00`
- id 2059 (Seiko King Seiko KS1969): lugWidth = 19 mm ← sibling id 886 `SJE109`
- id 4613 (Nodus Duality II Unity White): thickness = 11.5 mm ← sibling id 1320 `Duality II - Chasm Black`
- id 4615 (Nodus Duality II Chasm Black): thickness = 11.5 mm ← sibling id 1320 `Duality II - Chasm Black`
- id 4546 (Louis Erard Noirmont X Le Régulateur Louis Erard x Kudoke White Mop): thickness = 12.25 mm ← sibling id 1552 `85237AA49.BVA178`
- id 4548 (Louis Erard Noirmont X Le Régulateur Louis Erard x Kudoke Purple): thickness = 12.25 mm ← sibling id 1552 `85237AA49.BVA178`
- id 4175 (Fears Brunswick Jump Hour Raven Black): thickness = 12.8 mm ← sibling id 1798 `BS240.500A`
- id 4179 (Fears Brunswick Jump Hour Coral Lacquer): thickness = 12.8 mm ← sibling id 1798 `BS240.500A`
- id 3796 (Christopher Ward Trident C60 Trident Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3811 (Christopher Ward Trident C60): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3823 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3834 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3856 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3866 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3895 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3900 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3961 (Christopher Ward Trident C60 Pro 300): thickness = 11.5 mm ← sibling id 3791 `C60-42ADA31S0KW1-B0`
- id 3885 (Christopher Ward Bel Canto C1 Bel Canto Classic): thickness = 13 mm ← sibling id 3799 `C01-41APT0-T00B1-VLB`
- id 4010 (Christopher Ward Bel Canto C1 Bel Canto): thickness = 13 mm ← sibling id 3799 `C01-41APT0-T00B1-VLB`
- id 3838 (Christopher Ward Dune C65 Dune Aeolian): thickness = 11.7 mm ← sibling id 3803 `C65-38A3H4-S00E0-WC`
- id 3951 (Christopher Ward Dune C65 Dune Aeolian): thickness = 11.7 mm ← sibling id 3803 `C65-38A3H4-S00E0-WC`
- id 3814 (Christopher Ward Trident C60 Trident Lumière): thickness = 10.85 mm ← sibling id 4005 `C60-41C3H31T0KO0-RKO`
- id 3835 (Christopher Ward Trident C60 Lumière): thickness = 10.85 mm ← sibling id 3814 `C60-41C3H31T0KK0-B0`
- id 3839 (Christopher Ward Trident C60 Lumière): thickness = 10.85 mm ← sibling id 3814 `C60-41C3H31T0KK0-B0`
- id 3816 (Christopher Ward The Twelve C12): thickness = 9.95 mm ← sibling id 3938 `C12-38ADA1-S00W0-RK`
- id 3817 (Christopher Ward The Twelve C12 The Twelve 38): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3822 (Christopher Ward The Twelve C12): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3851 (Christopher Ward The Twelve C12 The Twelve 40): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3886 (Christopher Ward The Twelve C12 Ice Cream Twelve 38): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3889 (Christopher Ward The Twelve C12 The Twelve 40): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3892 (Christopher Ward The Twelve C12 The Twelve 40): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3904 (Christopher Ward The Twelve C12 The Twelve 38): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3912 (Christopher Ward The Twelve C12): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3942 (Christopher Ward The Twelve C12 The Twelve 40): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3949 (Christopher Ward The Twelve C12 The Twelve 38): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3964 (Christopher Ward The Twelve C12 The Twelve 38): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3968 (Christopher Ward The Twelve C12 The Twelve 40): thickness = 9.95 mm ← sibling id 3830 `C12-40ADA1-S00B1-B0`
- id 3992 (Christopher Ward The Twelve C12): thickness = 9.95 mm ← sibling id 3816 `C12-38ADA1-S00W0-B0`
- id 3820 (Christopher Ward Dune C65 Sandhurst Series 2): thickness = 11.9 mm ← sibling id 3901 `C65-38A3H3-S00K0-VC`
- id 3918 (Christopher Ward The Twelve C12): thickness = 12.3 mm ← sibling id 3829 `C12-41A5D0-T00K0-B0`
- id 3969 (Christopher Ward The Twelve C12): thickness = 12.3 mm ← sibling id 3829 `C12-41A5D0-T00K0-B0`
- id 3890 (Christopher Ward Sealander C63 Valour): thickness = 11.55 mm ← sibling id 3873 `C63-39QCC3-S00K0-B0`
- id 3947 (Christopher Ward Dune C65 Cranwell Series 2): thickness = 11.9 mm ← sibling id 3946 `C65-38A3H3-S00K1-VC`
- id 5525 (NTH 데빌레이 오렌지 데이트): thickness = 14.5 mm ← sibling id 5719 `데빌레이 블랙 데이트 IW154`
- id 5526 (NTH 데빌레이 터키 데이트): thickness = 14.5 mm ← sibling id 5525 `데빌레이 오렌지 데이트 IW266`

### NTH grouping convention (new)

One modelGroup per named design line and generation: shared-case colorway and date/no-date variants group; V2 generations get their own group (or stay single), DLC case coatings and single-member designs stay ungrouped. English canonicalModel/variant labels are set on Korean-named IntoWatch rows so they surface in text search (Korean is stripped from search_text).

- `nth-devilray` (10): 5525 Orange Date; 5526 Turquoise Date; 5719 Black Date; 5720 Black Non-Date; 5721 Blue Date; 5722 Blue Non-Date; 5723 White Date; 5724 White Non-Date; 5755 Orange Non-Date; 5756 Turquoise Non-Date
- `nth-subs-nacken-modern` (4): 5680 Blue Non-Date; 5681 Black Date; 5682 Black Non-Date; 5727 Blue Date
- `nth-subs-skipjack` (2): 5683 Date; 5684 Non-Date
- `nth-subs-barracuda-vintage-black` (2): 5685 Date; 5686 Non-Date
- `nth-subs-barracuda-vintage-black-v2` (2): 5768 Non-Date; 5769 Date
- `nth-subs-barracuda-polar-white` (2): 5730 Non-Date; 5731 Date
- `nth-subs-scorpene` (2): 5676 Blue Non-Date; 5732 White Non-Date
- `nth-subs-scorpene-nomad` (2): 5703 Black Non-Date; 5704 Black Date
- `nth-subs-tropics-azores` (2): 5748 Blue Curaçao; 5749 Absinthe
- `nth-subs-tropics-antilles` (4): 5750 Cointreau; 5751 Dark Rum; 5758 Hypnotic; 5759 Rosé
- `nth-2k1-thresher` (2): 5527 Black Date; 5528 Blue Date
- `nth-2k1-swiftsure` (3): 5740 Black Non-Date; 5741 Blue Non-Date; 5742 White Non-Date

Left ungrouped on purpose: Näcken Renegade/Vintage (cross-generation pair), Odin, Vanguard, Tikuna, Bahia, Amphion Vintage Gilt V1/V2 (generations), Oberon II, Barracuda Brown, Barracuda Vintage Black DLC (case coating), Näzario, Upholder V2, Todaro V2, Näcken Modern Blue V2, Scorpène Black V2 — singles or generation/coating mismatches.

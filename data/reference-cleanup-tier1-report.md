# Tier-1 reference cleanup (2026-10-28)

288 tier-1-brand rows held the watch name (or an IntoWatch `name IW<no>` label) in `reference`. Each was checked against its own sources, the brand's site and reputable dealers/databases. A reference was written only when a source ties it to that exact watch; otherwise `reference` is now empty (shown as "Reference not provided"). Every changed row keeps its old route in `data/legacy-routes.json`.

| Result | Rows |
|---|---:|
| Reference written | 107 |
| Empty: one row covers several references (dial/metal/strap/size) | 132 |
| Empty: no manufacturer reference found | 14 |
| Empty: reference already on another row (duplicate candidate) | 26 |
| Empty: conflicting evidence or wrong row data | 7 |
| Already a real reference (RM 66) | 1 |
| Deleted (8284, added on this branch with another Captain Cook's dimensions) | 1 |

F.P. Journe references are the brand's model codes (Ref. CB, LN, AL2 …), shared by every size of a model. Where two dial variants share a code and identical dimensions (4079/4082 CS, 4095/4104 AL2, 4106/4108 AL), the second row is left empty because the seed requires unique product numbers.

## Duplicate candidates (merge or retire)

The confirmed reference already belongs to another row, so these are probably the same watch imported twice.

| row | watch | reference | existing row |
|---|---|---|---|
| 2682 | Piaget Andy Warhol | G0A50241 | 4864 Andy Warhol Automatic White Gold |
| 2709 | Zenith G.F.J. | 40.1865.0135/51.C200 | 2265 G.F.J. Calibre 135 |
| 2733 | Hamilton American Classic Chrono-Matic 50 Auto Chrono Limited Edition | H51606640 | 1870 Chrono-Matic 50 Auto Chrono Limited Edition |
| 2767 | Breitling Avenger Night Mission | S17328101B1X1 | 3450 Avenger Automatic 42 Night Mission |
| 2772 | Breitling Navitimer B01 Chronograph 46 North American Limited Edition | UB01372A1C1P1 | 3530 Navitimer B01 Chronograph 46 |
| 2781 | TAG Heuer Monaco Chronograph Racing Green | CAW218E.FC6565 | 6125 Monaco |
| 2818 | Breitling Chronomat Giannis Antetokounmpo | A32398A11L1A1 | 1687 Chronomat Automatic GMT 40 Giannis Antetokonumpo |
| 2836 | Breitling Navitimer 41 And Cosmonaute B12 | RB12302A1L1P1 | 3536 Navitimer B12 Chronograph 41 Cosmonaute |
| 2848 | Omega Speedmaster Moonwatch White Lacquered Dial | 310.30.42.50.04.001 | 389 Speedmaster Moonwatch Professional Co-Axial Master Chronometer Chronograph 42 mm |
| 2905 | NOMOS Tangente Rose Gold Neomatik | 160.S1 | 4706 Tangente Rose Gold Neomatik - 175 Years Watchmaking Glashütte |
| 2919 | Omega Seamaster Planet Ocean Deep Black ETNZ Edition | 215.92.46.51.01.003 | 2004 Seamaster Planet Ocean 600M “ETNZ” Deep Black |
| 2933 | Glashütte Original Senator Chronometer Silver And Blue | 1-58-08-01-04-61 | 1829 Senator Chronometer |
| 2938 | Breitling Navitimer B01 Chronograph 46 U.S. Limited-Edition | UB01371A1B1P1 | 3481 Navitimer B01 Chronograph 46 |
| 5074 | Oris Big Crown Pointer Date Lou Gehrig Limited Edition | 01 754 7785 4091-Set | 1609 Big Crown Pointer Date Lou Gehrig Limited Edition 40mm |
| 5075 | Zenith G.F.J. Calibre 135 Naoya Hida & Co. | 40.1865-2.0135/01.C220 | 6285 G.F.J. Calibre 135 Double Signed With Naoya Hida & Co. |
| 6166 | Oris Lou Gehrig Big Crown Pointer Date Limited Edition | 01 754 7785 4091-Set | 1609 Big Crown Pointer Date Lou Gehrig Limited Edition 40mm |
| 6549 | Omega Seamaster Planet Ocean Ultra Deep Titanium | 215.92.46.21.01.001 | 299 Seamaster Planet Ocean 6000m Co-Axial Master Chronometer 45 5 mm |
| 6551 | NOMOS Orion Neomatik New Black 36 | 396 | 4690 Orion Neomatik New Black |
| 6596 | Breitling Top Time B01 Martini Racing | AB01772A1G1X1 | 3495 Top Time B01 Racing |
| 6626 | Tudor Black Bay Fifty-Four | 79000N | 6213 Black Bay 54 |
| 6842 | Glashütte Original Seventies X Chronograph | 1-37-02-18-02-70 | 1831 Seventies ‘X’ Chronograph |
| 7148 | Omega Speedmaster Pilot Flight Qualified | 332.10.41.51.01.002 | 404 Speedmaster Pilot Co-Axial Master Chronometer Chronograph 40 85 mm |
| 7307 | Chopard L.U.C Heritage Grand Cru | 162296-5001 | 3790 L.U.C Heritage Grand CRU |
| 7413 | TAG Heuer Monaco Chronograph Night Driver | CBL2181.FC6515 | 2188 Monaco Chronograph Night Driver |
| 8192 | TAG Heuer Carrera Chronograph x Fragment Limited Edition | CBS221B.BA0045 | 6162 Carrera Chronograph |
| 8194 | Glashütte Original PanoMaticCalendar Platinum | 1-92-11-01-03-61 | 1827 PanoMaticCalendar “Blue of Dawn” - Louisiana alligator leather strap |

Empty-reference pairs with identical dimensions (likely duplicates): 2818/6540, 6965/6997, 6967/7218, 7344/7413, 2995/8181, 5074/6166 (and 1609).

## Row data that looks wrong (left unchanged)

- 6860: the source never mentions a Rangeman; its 61.2 × 54.4 × 16.1 mm belong to the G-Shock GWG-2000 Mudmaster in that article.
- 7148 Speedmaster Pilot Flight Qualified: caseMm 44.25 is the Speedmaster Racing size; MONOCHROME gives 40.85 mm.
- 6398 Vacheron Constantin Traditionnelle Twin Beat: dimensions are the Breguet 7077 from the same article (Twin Beat is 42 × 12.3 mm).
- 6902: JLC's press release identifies the 40.1 × 24.4 × 7.56 mm pink gold watch as the Solo Tempo 'Or Deco' (Q716216J), not a Cocktail model; reference left empty until the name is fixed.
- 6424 Reverso Tribute Enamel Horse (Q39324D3): caseMm 29.9 against JLC's 27.4 mm width.

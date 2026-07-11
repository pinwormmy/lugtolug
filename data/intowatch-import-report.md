# IntoWatch import report

## Pass 2 (2026-07-11) — full-catalog sweep

Crawled the complete m.intowatch.com catalog (229 products across 19 categories, 4 s request spacing), OCR'd the long specification images with macOS Vision, and parsed dimensions with a two-pass parser (colon-delimited spec lines take precedence over narrative text; movement-section thickness lines are excluded).

Results:

- **135 new records registered** (ids 5672-5806): NTH 49, WMT 27, Gruppo Gamma 20, Borealis 18, Venturo 10, Prometheus 3, Axios 2, and six vintage one-off pieces filed under their original brands (Adanac, Hamilton, Eterna, Gallet, Smiths, Heuer).
- **Skipped 46 products already imported in pass 1** (matched by product number in existing source URLs).
- **Skipped 46 straps/accessories** (category- and keyword-filtered) plus 1 bracelet (product 322, BoR) that reached the parser but has no lug-to-lug.
- **Merged 1 duplicate**: product 437 (Adanac Military Navigator) is the same model as product 436 with identical dimensions; recorded as a second source on one row.
- **0 products failed extraction; 0 OCR conflicts remained** after the parser rework. Two initial conflicts (products 415, 416, where narrative sentences preceded the spec block) were resolved in favor of the colon-delimited specification lines and spot-verified against the images.

Notes / unusual values:

- WMT VECO S02 (id per reference IW416) lists a 24 mm case and 31 mm lug-to-lug — unusually small, but the narrative text and the specification image agree; verified visually.
- The six vintage pieces are secondhand one-offs sold by IntoWatch; dimensions were transcribed from IntoWatch's own condition-report spec images (e.g. Heuer Bundeswehr 1550 SG: 43 mm case, 50 mm lug-to-lug — verified visually against the image).
- Spot checks against the raw images: products 73, 240, 415, 416, 444 all match the parsed values exactly.

New records:

- Adanac — Military Navigator; source product 436; +product 437
- Axios — 아이언클래드 40 - 노던스카이; source product 162
- Axios — 아이언클래드 40 - 라이징선; source product 163
- Borealis — Navale Green Date; source product 109
- Borealis — Navale Blue Non-Date; source product 110
- Borealis — Navale Black Date; source product 111
- Borealis — Scorpionfish V2 Date; source product 121
- Borealis — Scorpionfish V2 Non-Date; source product 122
- Borealis — Adraga Steel 2AA; source product 123
- Borealis — Adraga Steel 2AB; source product 124
- Borealis — Adraga Steel 2BB; source product 125
- Borealis — 아드라가 2BD; source product 126
- Borealis — Adraga Steel 2BC; source product 127
- Borealis — Olisipo Black Date (올리시포 블랙); source product 148
- Borealis — Olisipo Blue Date (올리시포 블루); source product 149
- Borealis — Olisipo Green Date (올리시포 그린); source product 150
- Borealis — 불샤크 2AA; source product 345
- Borealis — 불샤크 2AB; source product 346
- Borealis — 불샤크 2AC; source product 347
- Borealis — 불샤크 2AD; source product 348
- Borealis — 불샤크 2AE; source product 349
- Eterna — Super KonTiki; source product 441
- Gallet — Chronograph; source product 442
- Gruppo Gamma — Divemaster DG-05; source product 107
- Gruppo Gamma — Divemaster DG-07; source product 108
- Gruppo Gamma — Vanguard AN-17; source product 131
- Gruppo Gamma — Vanguard AN-18; source product 132
- Gruppo Gamma — Peacemaker PN-19; source product 147
- Gruppo Gamma — 넥서스 NG-01; source product 186
- Gruppo Gamma — 넥서스 NV-02; source product 187
- Gruppo Gamma — 넥서스 ND-02; source product 188
- Gruppo Gamma — 다이브마스터 DG-06; source product 205
- Gruppo Gamma — 피스메이커 PG-02; source product 277
- Gruppo Gamma — 피스메이커 PG-03; source product 278
- Gruppo Gamma — 피스메이커 PA-02; source product 279
- Gruppo Gamma — 피스메이커 PA-03; source product 280
- Gruppo Gamma — 피스메이커 PG-00; source product 282
- Gruppo Gamma — 밴가드 AG-00; source product 327
- Gruppo Gamma — 밴가드 AG-01; source product 328
- Gruppo Gamma — 밴가드 AV-00; source product 329
- Gruppo Gamma — 피스메이커 PN-09; source product 360
- Gruppo Gamma — 밴가드 AG-10; source product 402
- Gruppo Gamma — 밴가드 AV-10; source product 403
- Hamilton — MIL-W-46374B; source product 438
- Heuer — Bundeswehr 1550 SG; source product 444
- NTH — Näcken Renegade Non-Date; source product 80
- NTH — Scorpène Blue Non-Date; source product 89
- NTH — Odin Black Non-Date; source product 92
- NTH — Näcken Modern Blue Non-Date; source product 97
- NTH — Näcken Modern Black Date; source product 99
- NTH — Näcken Modern Black Non-Date; source product 100
- NTH — Skipjack Date; source product 101
- NTH — Skipjack Non-Date; source product 102
- NTH — Barracuda Vintage Black Date; source product 103
- NTH — Barracuda Vintage Black Non-Date; source product 104
- NTH — Vanguard Non-date; source product 129
- NTH — Tikuna Non-date; source product 130
- NTH — Scorpène Nomad Black Non-Date; source product 133
- NTH — Scorpène Nomad Black Date; source product 134
- NTH — Näcken Vintage Black; source product 137
- NTH — Bahia; source product 138
- NTH — Amphion Vintage Gilt; source product 139
- NTH — Oberon II; source product 140
- NTH — 데빌레이 블랙 데이트; source product 154
- NTH — 데빌레이 블랙 넌데이트; source product 155
- NTH — 데빌레이 블루 데이트; source product 156
- NTH — 데빌레이 블루 넌데이트; source product 157
- NTH — 데빌레이 화이트 데이트; source product 158
- NTH — 데빌레이 화이트 넌데이트; source product 159
- NTH — Näcken Modern Blue Date; source product 170
- NTH — 바라쿠다 폴라 화이트 넌데이트; source product 183
- NTH — 바라쿠다 폴라 화이트 데이트; source product 184
- NTH — 스코펜 화이트 넌데이트; source product 185
- NTH — 바라쿠다 빈티지 블랙 DLC 넌데이트; source product 198
- NTH — 바라쿠다 브라운 넌데이트; source product 201
- NTH — 2K1 스위프트쇼어 블랙 넌데이트; source product 202
- NTH — 2K1 스위프트쇼어 블루 넌데이트; source product 203
- NTH — 2K1 스위프트쇼어 화이트 넌데이트; source product 204
- NTH — 나자리오 비노 로소 넌데이트; source product 206
- NTH — 트로픽 아조레스 블루 쿠라사오 넌데이트; source product 245
- NTH — 트로픽 아조레스 압생트 넌데이트; source product 246
- NTH — 트로픽 안틸레스 쿠앵트로 넌데이트; source product 247
- NTH — 트로픽 안틸레스 다크 럼 넌데이트; source product 248
- NTH — 데빌레이 오렌지 넌데이트; source product 265
- NTH — 데빌레이 터키 넌데이트; source product 267
- NTH — 트로픽 안틸레스 힙노틱 넌데이트; source product 275
- NTH — 트로픽 안틸레스 로제 넌데이트; source product 276
- NTH — 업홀더 V2 넌데이트; source product 292
- NTH — 토다로 V2 넌데이트; source product 293
- NTH — 나켄 모던 블루 V2 넌데이트; source product 294
- NTH — 바라쿠다 빈티지 블랙 V2 넌데이트; source product 295
- NTH — 바라쿠다 빈티지 블랙 V2 데이트; source product 296
- NTH — 암피온 빈티지 길트 V2 넌데이트; source product 343
- NTH — 스코펜 블랙 V2 넌데이트; source product 344
- Prometheus — Prometheus Eagle Ray 5B; source product 73
- Prometheus — Prometheus Eagle Ray 5B.1; source product 74
- Prometheus — Prometheus Eagle Ray 5E.1; source product 75
- Smiths — W10; source product 443
- Venturo — Field Watch #1 - 크림; source product 93
- Venturo — Field Watch #1 - SWAG LE; source product 96
- Venturo — Field Watch #2 - 크림; source product 141
- Venturo — Field Watch #2 - 블랙; source product 142
- Venturo — Field Watch #2 - 클래식블루; source product 143
- Venturo — Field Watch #2 - 블랙 선버스트; source product 144
- Venturo — Field Watch #2 - 블루 선버스트; source product 145
- Venturo — Field Watch #2 - 그레이 선버스트; source product 146
- Venturo — 스킨다이버 C3 넌데이트; source product 195
- Venturo — 스킨다이버 임퍼펙트 에디션 넌데이트; source product 197
- WMT — 로열 마린 - 섭다이버; source product 175
- WMT — 씨울프 - 밀스펙; source product 180
- WMT — 씨다이버 - 허니콤브 빅크라운; source product 213
- WMT — 씨울프 - 오하이오; source product 240
- WMT — 로열 마린 - 트로피컬 브라운 세트; source product 242
- WMT — 씨울프 - 대한민국 해군 (ROKN); source product 254
- WMT — 로열 마린 - 블랙; source product 256
- WMT — 팬톤 - 화이트; source product 257
- WMT — 엠버 - 에이징 에디션; source product 274
- WMT — 로열 마린 - MI6-B; source product 325
- WMT — 바라쿠다 - 블랙; source product 361
- WMT — 카보숑 - 오만 레드; source product 362
- WMT — 씨울프 - 밀스펙 1; source product 365
- WMT — 그린라벨 - RM0030PO; source product 369
- WMT — 그린라벨 - RM0060C 세트; source product 370
- WMT — 그린라벨 - MZ0010C; source product 415
- WMT — VECO S02; source product 416
- WMT — 로열네이비 HSC; source product 417
- WMT — 그린라벨 SW0020C; source product 419
- WMT — 그린라벨 CB0150C; source product 420
- WMT — 그린라벨 W150040C; source product 421
- WMT — 카보숑 - 트로피컬; source product 422
- WMT — 카보숑 - 블루 라브라도라이트석; source product 424
- WMT — 팬톤 MKII - 브라운 다이얼; source product 425
- WMT — WMT Chrono Club - Curvex G01; source product 430
- WMT — 루파스 밀스펙 MK1 세트; source product 431
- WMT — 밀섭 Mk1 블랙 스페셜 에디션; source product 432

## Pass 1 (2026-07-11) — first listing pages only

Imported 46 current microbrand watch records from the first visible product page of each brand category. Product specifications are image-based; values were transcribed with macOS Vision OCR and grouped only where the image clearly exposed case and lug-to-lug dimensions. Vintage watches, straps, and ambiguous OCR results were excluded. (See git history for the original 46-item list.)

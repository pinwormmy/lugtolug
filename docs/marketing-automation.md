# 마케팅 자동화 운영 가이드

DB(`data/watches.seed.json` + D1 승인 레코드)를 홍보 자산으로 바꾸는 자동화. 원칙: **감지·생성은 자동, 발행·대응은 수동.**

## 1. 프로그래매틱 SEO

시계마다 `/watches/<brand>/<model>/<reference>` 페이지가 이미 서버 렌더링되고, 페이지 템플릿이 자동으로 넣어주는 것:

- `<title>` / meta description / canonical / Open Graph / Twitter 카드 (`src/layouts/BaseLayout.astro`)
- Product + BreadcrumbList JSON-LD (시계 상세), CollectionPage JSON-LD (브랜드 페이지)
- `/sitemap.xml` — 전체 URL 자동 나열 (현재 약 5,600개), `/robots.txt`가 sitemap 위치 광고

즉 시계를 DB에 추가·승인하는 것만으로 색인 대상 페이지가 늘어난다. 별도 페이지 생성 스크립트는 필요 없음.

### 색인 제출

**Bing·Naver·Yandex (IndexNow)** — 스크립트로 즉시 제출:

```bash
npm run seo:indexnow                 # 라이브 sitemap의 모든 URL 제출
npm run seo:indexnow -- --dry-run    # 제출 없이 확인만
npm run seo:indexnow -- /watches/rolex/submariner-date/126610ln   # 특정 페이지만
```

- 키 파일: `public/863843d321b54f1373b1546d09cf0c6c.txt` (배포되면 사이트 루트에서 서빙됨 — **이 변경이 배포된 뒤부터 동작**)
- 돌리는 시점: 새 시계가 대량 승인됐을 때, 또는 주 1회
- 네이버 서치어드바이저에 사이트를 등록하면 IndexNow 제출이 네이버에도 반영된다

**Google** — sitemap ping API가 폐지되어(2023) 스크립트 제출 불가. 1회 설정 후 자동 크롤에 맡긴다:

1. [Search Console](https://search.google.com/search-console)에서 `lugtolugfinder.com` 도메인 속성 등록 (DNS TXT 인증 — Cloudflare DNS에서 1분)
2. Sitemaps 메뉴에 `https://lugtolugfinder.com/sitemap.xml` 제출 (1회)
3. 이후에는 Search Console이 sitemap을 주기적으로 다시 읽으므로 추가 작업 없음. 색인 현황도 여기서 확인

## 2. 키워드 모니터링 (Reddit)

```bash
npm run monitor:keywords
```

- 설정: `data/keyword-monitor.config.json` (키워드, 서브레딧, 쿼리당 개수)
- 첫 실행은 기존 글을 기준선으로 저장만 하고, 이후 실행부터 **새 글만** 출력
- 상태: `data/keyword-monitor.state.json` (gitignore됨) — `--reset`으로 초기화
- 알림: `KEYWORD_MONITOR_WEBHOOK` 환경변수에 Discord 웹훅 URL을 넣으면 새 언급마다 전송
- Reddit 무인증 제한(분당 ~10요청) 때문에 요청 간 8초 대기 → 한 번 도는 데 약 2분

정기 실행 (crontab 예시, 6시간마다):

```cron
0 */6 * * * cd /Users/eol/Documents/lugtolug_finder && /usr/local/bin/node scripts/keyword-monitor.mjs >> /tmp/keyword-monitor.log 2>&1
```

보완: 댓글 언급은 이 스크립트가 못 잡는다. [F5Bot](https://f5bot.com) (무료, 이메일 가입만 하면 됨)에 `lug to lug`, `lugtolugfinder`를 등록하면 포스트+댓글 모두 이메일 알림. **답변/댓글 작성은 항상 직접** — 자동 포스팅은 하지 않는다.

## 운영 리듬 제안

| 주기 | 작업 | 명령 |
| --- | --- | --- |
| 데이터 대량 추가 후 | 색인 제출 | `npm run seo:indexnow` |
| 6~12시간마다 (자동) | 키워드 감지 | `npm run monitor:keywords` (cron) |
| 주 1회 | 색인 현황 확인 | Search Console 대시보드 |

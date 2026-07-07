# Lug to Lug Finder

English-first MVP for searching watch lug-to-lug, case diameter, thickness, lug width, and wrist-fit guidance.

## Stack

- Astro + React + TypeScript
- Cloudflare Pages adapter
- Cloudflare D1 for approved watches, private submissions, admin users, and sessions
- Vitest for focused logic tests

## Local setup

```bash
npm install
npm run dev
```

Public pages can render from `data/watches.seed.json` without D1. Submission and admin flows require D1.

```bash
npm run db:migrate:local
npm run db:seed:local
node scripts/create-admin-sql.mjs operator@example.com "change-this-password"
```

Run the printed SQL against local or remote D1 with `wrangler d1 execute`.

Workflow smoke check:

```bash
SMOKE_ADMIN_EMAIL=operator@example.com \
SMOKE_ADMIN_PASSWORD=change-this-password \
npm run smoke:workflow -- --base-url http://127.0.0.1:4321
```

The smoke script expects a running local preview server and a seeded D1 database. It submits two watches, approves one, rejects the other, and verifies the approved watch page is reachable.

## Marketing automation

SEO indexing (IndexNow) and Reddit keyword monitoring are documented in
[docs/marketing-automation.md](docs/marketing-automation.md).

```bash
npm run seo:indexnow -- --dry-run
npm run monitor:keywords
```

## Cloudflare deployment

Live deployment naming:

- Product/site name: `Lug to Lug Finder`
- GitHub repository: `pinwormmy/lugtolug`
- Cloudflare Pages project: `lugtolug`
- Production domain: `lugtolug.pages.dev`
- D1 database: `lugtolug-finder`

The older `lugtolug-finder` Pages project is not the live Git-connected deployment.

Target Pages settings:

- Repository: `pinwormmy/lugtolug`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Project name: `lugtolug`

### Custom domain setup

Until a custom domain is configured, production canonical URLs use:

```bash
https://lugtolug.pages.dev
```

After buying a domain, keep the Cloudflare Pages project as the host and add the domain in Cloudflare:

1. Add the domain to Cloudflare DNS, or buy it through Cloudflare Registrar.
2. In the `lugtolug` Pages project, add the apex domain and `www` as custom domains.
3. Set the production build environment variable:

```bash
PUBLIC_SITE_URL=https://www.example.com
```

Use the preferred public origin here. This value drives canonical URLs, Open Graph URLs, `robots.txt`, and `sitemap.xml`.

Recommended DNS shape:

- Apex: Cloudflare Pages custom-domain record managed by Cloudflare.
- `www`: Cloudflare Pages custom-domain record managed by Cloudflare.
- Redirect the non-preferred host to the preferred host from Cloudflare once both hosts are active.

Cloudflare resources:

```bash
npm run cf:pages:create
npm run db:create:remote
npm run kv:create:session
```

Copy the created D1 `database_id` and KV `id` into `wrangler.toml`.

Production setup:

```bash
npm run db:migrate:remote
npm run db:seed:remote
npm run cf:secret:session
npm run admin:sql -- operator@example.com "change-this-password"
```

Run the printed admin SQL against production D1:

```bash
wrangler d1 execute lugtolug-finder --remote --command="<printed SQL>"
```

Before deployment, run:

```bash
npm run deploy:check
```

After deployment, verify:

- `/`
- `/watches`
- watch detail pages
- `/submit`
- `/admin/login`
- admin approve/reject flow
- `/sitemap.xml`
- `/robots.txt`

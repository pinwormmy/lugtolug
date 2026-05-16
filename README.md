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

## Cloudflare deployment

Target Pages settings:

- Repository: `pinwormmy/lugtolug`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Project name: `lugtolug-finder`

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

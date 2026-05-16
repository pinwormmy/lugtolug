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

1. Create a Cloudflare Pages project connected to this repo.
2. Create preview and production D1 databases.
3. Replace `database_id` in `wrangler.toml` for real environments.
4. Apply migrations and seed data.
5. Set `SESSION_SECRET` as an environment variable.
6. Create the first admin user with `scripts/create-admin-sql.mjs`.

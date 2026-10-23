# Deployment (Vercel + managed PostgreSQL)

## Architecture on Vercel
Static SPA from `dist/` + one Node serverless function (`api/index.ts`) wrapping Express. `vercel.json` rewrites `/api/*` to the
function and everything else to `index.html`. A persistent Express server is **not** used.

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Name | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Pooled connection string (e.g. Supabase transaction pooler, port 6543, IPv4-compatible). Needed at build **and** runtime |
| `SESSION_SECRET` | yes | ≥32 chars (`openssl rand -hex 32`) |
| `PAYMENT_WEBHOOK_SECRET` | yes | ≥32 chars |
| `APP_URL` | yes | Public origin, e.g. `https://isoftstone.example.com` (CORS + CSRF origin check) |
| `NODE_ENV` | auto | `production` on Vercel |
| `PAYMENT_PROVIDER` | no | `none` (default). `dev_simulator` only for demos, and then also `ALLOW_PAYMENT_SIMULATOR=true` |
| `TRADING_PROVIDER` | no | `none`. `demo` is refused in production |
| `SEED_DEMO` | no | `true` publishes illustrative draft challenges at build time. Leave unset for a real launch |
| `SUPPORT_EMAIL` | no | Shown in footer/contact |

No secret is ever prefixed `VITE_`; the browser bundle contains no credentials.

## What the build does (`npm run vercel-build`)
`migrate` (idempotent SQL migrations) → `seed` (idempotent base data) → `gen-seo` (sitemap/robots) → `vite build`.

## First-time setup
1. Create the database; set `DATABASE_URL`, `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `APP_URL`.
2. Deploy. 3. Provision an admin: run `ADMIN_EMAIL=… ADMIN_PASSWORD=… DATABASE_URL=… npm run admin:create` from any machine that can reach the DB.
4. Sign in at `/login`, review challenges under Admin → Challenges, **approve** final terms, and turn off "Show draft offers".

## Rollback
Redeploy a previous deployment from the Vercel dashboard. Migrations are additive; write a compensating migration rather than editing history.

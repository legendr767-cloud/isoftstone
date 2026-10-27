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
| `PAYMENT_PROVIDER` | no | `none` (default), `kora`, or `dev_simulator` (demos only; also needs `ALLOW_PAYMENT_SIMULATOR=true`) |
| `KORA_SECRET_KEY` | with `kora` | Kora secret key; also verifies webhook signatures |
| `KORA_CURRENCY` | no | Charge currency (default `USD`); must be enabled on your Kora account |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` / `EMAIL_FROM` | no | `resend` to deliver verification, reset and support emails |
| `DATABASE_CA` | no | PEM of the database CA for full TLS verification |
| `TRADING_PROVIDER` | no | `none`. `demo` is refused in production |
| `SUPPORT_EMAIL` | no | Shown in footer/contact |

No secret is ever prefixed `VITE_`; the browser bundle contains no credentials.

## What the build does (`npm run vercel-build`)
`migrate` (idempotent SQL migrations) → `seed` (idempotent base data) → `gen-seo` (sitemap/robots) → `vite build`.

## First-time setup
1. Create the database; set `DATABASE_URL`, `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `APP_URL`.
2. Deploy. 3. Provision an admin: run `ADMIN_EMAIL=… ADMIN_PASSWORD=… DATABASE_URL=… npm run admin:create` from any machine that can reach the DB.
4. Sign in at `/login`; review prices under Admin → Challenges and the legal text under Admin → Legal documents.
5. For payments: set `PAYMENT_PROVIDER=kora`, `KORA_SECRET_KEY`, and register `https://<domain>/api/v1/payments/webhook/kora` as the webhook URL in the Kora dashboard. Run a **test-mode** payment first (`sk_test_…`) and check the order turns PAID.

## Rollback
Redeploy a previous deployment from the Vercel dashboard. Migrations are additive; write a compensating migration rather than editing history.

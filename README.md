# iSoftStone — Forex Proprietary Trading Evaluation Platform

A forex-only, PERN-stack platform: marketing site, challenge marketplace, customer dashboard, admin console,
checkout with verified payment webhooks, and provider abstractions for future broker/payment integrations.

> **Catalogue.** Six forex models (One-Step, Two-Step Forex / Standard / Pro, Three-Step, Blitz) with an optional 100% profit-split add-on. Instant funding is intentionally not offered. Terms mirror the public structure of the reference firm; **prices are starting values editable in Admin → Challenges.**
>
> **Market data.** Price charts use real ECB reference rates (via Frankfurter), updated each working day. They are not tradable quotes.
>
> **Scope & honesty.** Accounts are *simulated evaluation accounts*, not live brokerage accounts. Payments, trading-platform
> data, email delivery and identity verification are **not connected to real providers** until credentials are supplied
> (see [Integrations that need credentials](#integrations-that-need-external-credentials)). Commercial terms in the seed data are
> **illustrative drafts** and must be approved before real sale.

## Stack
| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts, Framer Motion, Lucide |
| Backend | Node.js, Express, TypeScript, Zod validation, pino logging, helmet, express-rate-limit |
| Database | PostgreSQL via Drizzle ORM, versioned SQL migrations in `drizzle/` |
| Auth | Argon2id, opaque DB-backed sessions in HTTP-only cookies, double-submit CSRF + Origin check |
| Hosting | Vercel (static SPA + one serverless function for `/api`), managed PostgreSQL |
| Tests | Vitest (unit, API integration against real Postgres, jsdom components), Playwright (E2E, run in CI) |

> Prisma was the first choice, but its engine binaries could not be downloaded in the build sandbox, so migrations could not be
> verified. Drizzle (explicitly allowed by the brief) is pure JavaScript and fully verified.

## Quick start
```bash
cp .env.example .env            # fill in values (see comments in the file)
npm ci
createdb isoftstone_dev         # or any Postgres 14+ database; set DATABASE_URL
npm run db:migrate              # apply migrations
npm run db:seed                 # roles, permissions, forex instruments, FAQ, legal documents, add-on and the six forex challenges
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-unique-passphrase' npm run admin:create
npm run dev                     # API :4000 + Vite :5173 (Vite proxies /api)
```
Load the `.env` into your shell (e.g. `set -a; source .env; set +a`) — the server reads `process.env` directly.

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | API + web in watch mode |
| `npm run typecheck` / `npm run lint` | `tsc` for web+server; ESLint |
| `npm test` | all Vitest projects (unit, api, web) |
| `npm run test:e2e` | Playwright journeys (needs a browser; CI installs one) |
| `npm run db:generate` | generate a new migration from `server/db/schema.ts` |
| `npm run db:migrate` / `db:seed` | apply migrations / idempotent seed (never overwrites edited challenges) |
| `npm run admin:create` | provision an administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD` |

## Testing
API tests run against a **real PostgreSQL** database that the test harness drops and rebuilds (migrations + seed) on every run.
```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/isoftstone_test npm test
```
Covered: registration/login/lockout/reset, CSRF, authorization & role permissions, challenge filtering, forex-only validation,
approval gating, server-side price verification, signed/idempotent/replay-protected webhooks, amount-mismatch handling,
ownership (IDOR) checks, reward eligibility + review workflow, audit logging, wildcard-safe search, decimal-safe maths,
component behaviour and protected routes. Playwright specs live in `tests/e2e` and run in GitHub Actions (`.github/workflows/ci.yml`).

## Forex-only enforcement (defence in depth)
1. DB: `asset_class` enum has one value (`FOREX`); `CHECK` constraints require `AAA/BBB` symbols with a consistent base/quote.
2. API: instruments must be in the approved ISO-currency whitelist and the `instruments` table; product text is scanned for
   futures/index/crypto/commodity terms (`server/services/forex.ts`) and rejected with `422`.
3. Admin UI offers only the approved instrument list; the server is the authority.

## Security summary
Argon2id hashing · opaque server-side sessions (hashed in DB) · `HttpOnly`/`Secure`/`SameSite=Lax` cookies (`__Host-` prefix in production) ·
CSRF double-submit + Origin check · DB-backed account lockout · rate limiting · helmet + strict CSP · Zod validation everywhere ·
ownership checks return `404` · permissions enforced server-side · no manual "mark paid" · HMAC-SHA256 webhooks with timestamp tolerance
and unique event IDs · amount/currency re-verified against the order · audit log for sensitive admin actions · secrets only in env vars.

Known limitations: rate-limit counters are per serverless instance (login lockout is DB-backed and cross-instance); MFA is schema-only;
no email delivery until a provider is configured; no malware-scanned file uploads (uploads are not offered).

## Integrations that need external credentials
| Integration | Status | What is needed |
|---|---|---|
| Payment gateway | **Kora implemented** (hosted checkout, HMAC-verified webhooks, API confirmation before fulfilment). Inactive until `PAYMENT_PROVIDER=kora` + `KORA_SECRET_KEY` are set. `dev_simulator` is dev/preview only | Kora secret key (`sk_test_…` then `sk_live_…`); webhook URL `https://<domain>/api/v1/payments/webhook/kora` set in the Kora dashboard; confirm your Kora account can charge in `KORA_CURRENCY` (default USD) |
| Trading platform / broker | **Not connected.** `none` by default; `demo` fixtures for development only (refused in production) | Platform/broker API access; implement `TradingProvider` (`server/services/trading-provider.ts`) incl. provisioning |
| Email | **Resend implemented**, inactive until `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (and a verified sending domain in `EMAIL_FROM`) are set. Without it, verification/reset links are not delivered | Resend API key + domain |
| Identity verification (KYC) | **Manual.** Staff set status in Admin → Customers | Optional KYC vendor |
| Payout transfers | **Not connected.** "Processed" is an internal workflow state | Payout provider; set `transfer_ref` on completion |
| Legal documents | **Written, pending counsel review.** Editable in Admin → Legal documents (versioned) | Legal entity, jurisdiction, retention, payout terms |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). OpenAPI: `GET /api/v1/openapi.json`.

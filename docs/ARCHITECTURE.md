# Architecture

```
Browser ── React SPA (Vite build, served by Vercel CDN)
   │  same-origin /api/*  (cookies, CSRF header)
   ▼
Vercel serverless function  api/index.ts  → Express app (server/app.ts)
   ├─ middleware: pino-http, helmet, CORS(APP_URL), json(100kb), cookies, rate-limit, session, CSRF
   ├─ /api/v1/auth      register · login · logout · me · verify · reset · change-password
   ├─ /api/v1/me/*      customer: profile, dashboard, accounts, rewards, orders, tickets, notifications  (always scoped to session user)
   ├─ /api/v1/orders    create (server-side pricing) · pay (idempotent)
   ├─ /api/v1/payments  webhook/:provider (raw body, HMAC) · simulator (dev/preview only)
   ├─ /api/v1/admin/*   permission-gated: challenges, customers, orders (read-only), tickets, rewards, accounts, audit, settings
   └─ /api/v1/*         public: health, site, challenges, instruments, faq, legal, contact
   ▼
PostgreSQL (Drizzle schema in server/db/schema.ts, SQL migrations in drizzle/)
```

## Key flows
**Checkout** `POST /orders` (client sends only product IDs; price/add-ons recomputed from DB; terms recorded) →
`POST /orders/:id/pay` (creates an idempotent `payment_attempt`; provider session) → provider calls
`POST /payments/webhook/:provider` → signature + timestamp verified → event stored under `unique(provider,event_id)` →
transaction locks the order row, verifies amount/currency, marks `PAID`, creates **account records in `PENDING_PROVISIONING`**,
notifies the customer. Replays and duplicates are no-ops. A browser redirect never changes payment state.

**Rules engine** (`server/services/rules.ts`): integer-cent maths for profit, target progress, daily/overall drawdown allowance and
breach flags; `evaluateRewardEligibility` is the single server-side authority for reward requests.

**Provider abstractions**: `PaymentProvider`, `TradingProvider`, `sendMail` — swap implementations without touching routes.

**Catalogue visibility**: a challenge is public only if `PUBLISHED` **and** (terms approved **or** the admin switch
`showDraftOffers` is on). Draft-term products cannot be purchased unless the payment simulator is active.

## Data model (summary)
users, user_profiles, roles/permissions/role_permissions, sessions, email_verification_tokens, password_reset_tokens, mfa_factors ·
instruments, challenges, challenge_stages, challenge_rules, account_size_options, products, product_addons, challenge_instruments ·
orders, order_items, order_events, payment_attempts, payment_webhook_events ·
trading_accounts, account_phase_history, account_metric_snapshots, trade_records, reward_requests ·
support_tickets, support_messages, notifications, faq_items, legal_documents/versions/acceptances, site_config, audit_logs.
Money is `NUMERIC(p,2)` handled as strings / integer cents; never floats.

# NEWMUX OS

Internal operations, finance, and delivery platform for NEWMUX — a mobile-first
PWA covering the Executive Dashboard, Document Engine (quotes/contracts/invoices
with PDF export), Project Execution + Secrets Vault, Paddle SaaS billing
ingestion, and a Growth/Marketing attribution tracker.

## Current status: frontend-complete, backend deferred

All 6 modules are implemented against an **in-memory mock data layer**
(`lib/data/*`) instead of a live Postgres database. This was a deliberate
scoping decision (Supabase project creation hit the account's free-tier
project limit; the user chose to proceed with frontend work rather than
resolve that first).

- The full Postgres schema this mirrors lives in `db/migrations/*.sql`,
  written but **not yet applied** to any live project.
- `lib/data/store.ts` seeds sample users, clients, documents, projects,
  tasks, SaaS subscriptions, and campaigns on first access, and re-seeds on
  every process restart (data is not persisted to disk).
- Every `lib/data/*.ts` module is shaped so it can be swapped for real
  `sql` queries (via `lib/db.ts`, already wired for Supabase Postgres)
  without changing any caller in `app/` or `components/`.

**Important dev-mode caveat:** because the mock store lives in a module-level
`global` variable, run the app with `npm run build && npm run start`
(production-style, single compiled server) rather than `npm run dev` when you
need state to persist across requests — Next.js's dev server recompiles
route modules independently, which can cause the store to reseed per route
until Supabase is wired in.

## Getting started

```bash
npm install
npm run build
npm run start
```

On first request, the server console prints seeded login credentials:

```
[NEWMUX OS] Seeded mock admin login → email: m4ahmed7@gmail.com password: <random>
[NEWMUX OS] Seeded mock lead_dev login → email: lead.dev@newmux.internal password: changeme123
```

Copy `.env.example` to `.env.local` and fill in at least `NEXTAUTH_SECRET` /
`AUTH_SECRET` and `VAULT_SESSION_SECRET` (random strings) before running —
Supabase/`DATABASE_URL` vars are not required yet since nothing reads them.

## Roles

- **Partner / Core Admin** — full access, including Documents, Growth, and
  vault secret reveal.
- **Lead Developer / Designer** — Dashboard (read-only), Projects & Tasks
  (full), Vault (masked only, no reveal). No access to Documents or Growth.

## Wiring in the real backend later

1. Provision a Supabase project (a free-tier slot must be available, or
   reuse/upgrade the account's org).
2. Apply `db/migrations/0001` through `0007` via Supabase's migration tooling.
3. Replace the bodies of `lib/data/*.ts` functions with `sql` queries against
   `lib/db.ts` — function signatures are designed to stay the same.
4. Point `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   at the new project.
5. Replace the vault's session-cookie secret and Paddle webhook secret with
   real production values.

## Testing the Paddle webhook without a live account

```bash
PADDLE_WEBHOOK_SECRET=test-secret npm run test:paddle-webhook
```

Hand-signs a sample `subscription.created` event and posts it twice to
confirm signature verification and idempotency (the second delivery should
be a no-op).

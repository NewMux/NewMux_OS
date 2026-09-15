# NEWMUX OS / Internal ERP

Internal operations platform for NEWMUX. Started as a generic agency/SaaS
dashboard (Executive Dashboard, Document Engine, Secrets Vault, Paddle
billing, Growth tracker) and was then merged with the real **Newmux Internal
ERP PRD** (Jassim Baqer → Mohammed, Sept 2026) on top of that foundation, so
both sets of modules coexist:

- **ERP core (the real spec, Phase 1 built)**: Finance (recurring expenses,
  profit-split engine, quotation→invoice conversion, partial payments,
  automatic profit/loss calculation) and admin Settings (payout parties,
  deduction types, per-project/venture profit-split rules).
- **Original generic modules (kept per "merge both" decision)**: Executive
  Dashboard, Documents (PDF export), Projects/Tasks, Secrets Vault, Paddle
  webhook ingestion, Growth attribution tracker.
- **Not yet built** (PRD phases 2–5): Hosting Fee Tracking & Reminders,
  Client Directory page, Project Detail technical pages, Meetings & Tasks,
  Company Profile, Reports & Export, Newmux's Own Ventures page, and the
  suggested additions (audit log UI, cash flow forecast, Notion migration
  checklist). Seed data for these already exists in `lib/data/store.ts`
  (real clients: Marasi Alsawadi, Al Hussam Tailor, Ox Roastery, Voya; real
  ventures: Tbadel, Al-Mutadarrib/MTDRB, the Tailor System) — only the UI is
  missing.

**Money handling is currency-aware, not USD-only**: BHD (Newmux's real
invoicing currency) has 3 decimal places, and `lib/money.ts` divides by the
correct power of 10 per currency instead of assuming cents. A fixed
USD↔BHD peg rate handles the one real cross-currency case (an invoice's
linked hosting cost is paid in USD but invoiced to the client in BHD) — see
the Ox Roastery example below, which reproduces the PRD's worked example
(section 17) exactly: 15.000 BHD invoice − 4.700 BHD prorated/converted
vendor cost = 10.300 BHD net profit, split 5.150/5.150 between Jassim and
Mohammed.

## Current status: frontend-complete, backend deferred

All modules are implemented against an **in-memory mock data layer**
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
[NEWMUX ERP] Seeded Mohammed's login → email: m4ahmed7@gmail.com password: <random>
[NEWMUX ERP] Seeded Jassim's login → email: jassim@newmux.com password: changeme123 (placeholder email)
[NEWMUX ERP] Seeded demo limited-access login → email: lead.dev@newmux.internal password: changeme123
```

Jassim's seeded email is a placeholder — update `lib/data/store.ts` with his
real login email before this goes anywhere near real use.

Copy `.env.example` to `.env.local` and fill in at least `NEXTAUTH_SECRET` /
`AUTH_SECRET` and `VAULT_SESSION_SECRET` (random strings) before running —
Supabase/`DATABASE_URL` vars are not required yet since nothing reads them.

## Roles

- **Partner Admin** (Mohammed, Jassim) — full access to everything,
  including Finance, Settings, Documents, Growth, and vault secret reveal.
  The PRD limits full admin access to these two specifically.
- **Demo limited-access user** (`lead_dev` role, not built out per PRD 2.2
  yet — architecture supports it, specific permissions aren't decided) —
  Dashboard (read-only), Projects & Tasks (full), Vault (masked only, no
  reveal). No access to Documents, Finance, Growth, or Settings.

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

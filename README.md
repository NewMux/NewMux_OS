# NEWMUX OS

One app for running NEWMUX: **CRM, project management, finance and a knowledge base**, designed to feel like a native Apple app on iPhone, iPad and Mac.

- **Home**: a greeting, quick actions (new deal, task, invoice, expense or page), and widgets for today, cash this month, receivables and pipeline. Also shows your tasks, follow-ups due, renewals and hosting fees that need attention, and your favorite wiki pages.
- **CRM**:
  - deals pipeline board (drag, or long-press on iPhone), with deal detail, won/lost handling, a one-tap "Create Project", and a quote or invoice from the deal;
  - clients (companies) with tabs for Info, Deals, Work, Money and Wiki;
  - contacts in a Contacts-app style list, with one-tap call, WhatsApp and email;
  - an activity timeline with follow-up reminders.
- **Work**:
  - Reminders-style smart lists (Today, Next 7 Days, Overdue, All Mine);
  - projects with progress rings, each with a board, list and details view;
  - a task sheet with subtasks, comments, assignee, due date and priority;
  - a calendar agenda with a week strip, where "Notes" opens a linked meeting-notes wiki page.
- **Finance**:
  - collected, spent, net profit and receivables at a glance;
  - a 12-month cash-flow chart, receivables aging, profit by partner, and a 3-month forecast;
  - invoices, quotes and contracts with a lifecycle, partial payments, quote → invoice conversion and PDFs;
  - one-off and recurring expenses, hosting-fee collection, and reports with CSV/PDF export and an audit log.
- **Wiki**:
  - spaces holding nested pages, edited in an Apple Notes-style editor with autosave, checklists, headings, quotes, code and links;
  - templates, favorites, recently viewed pages and full-text search;
  - pages can be linked to clients, projects and deals.
- **Company**: registration and renewals, certifications, partnerships, ventures with their own profit split, the credentials **Vault** (AES-256-GCM) and **Growth** (campaign attribution, MRR).
- **Everywhere**:
  - global search (the Search tab, or ⌘K on iPad/Mac);
  - light/dark appearance that follows the system, with an override in Settings;
  - installable as a PWA (Safari → Share → Add to Home Screen).

## Design system

- **Tokens:** Apple's semantic colors (system grouped backgrounds, labels, separators, system blue/green/red/…) in light and dark. They are defined in `app/globals.css` and exposed to Tailwind as `bg-bg`, `text-label-2`, `bg-ios-green` and so on.
- **Type:** the SF Pro system font stack with the Dynamic Type scale (`text-large-title`, `text-headline`, `text-footnote` …). It steps down one size on iPad/Mac.
- **Inputs:** all form fields are at least 16px, so iOS never zooms in on focus.
- **Components** (`components/ui/`):
  - `Page`: a large title that collapses into a frosted nav bar;
  - `ListSection`/`ListRow`: inset grouped lists;
  - `Sheet`/`FormSheet`: bottom sheets with a grabber and drag-to-dismiss, which become centered dialogs on desktop;
  - `useConfirm`: iOS action sheets;
  - `SegmentedControl`, `Toggle`, `CheckCircle`, `Badge`, `Avatar`, `Widget`, `ProgressRing`, `Menu` (context menu) and `SearchField`.
- **Navigation:**
  - iPhone: a floating 5-tab bar (Home, CRM, Work, Finance, Wiki) plus a search button;
  - iPad/Mac: a Mail-style sidebar.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind 3 · next-auth v5 (credentials) · Postgres · TipTap · dnd-kit · vaul · sonner · cmdk.

### Database

All data lives in Postgres, and the schema is in `db/migrations/*.sql`. `lib/db.ts` picks a backend:

| `DATABASE_URL` | Backend |
| --- | --- |
| set | **Supabase Postgres** via postgres.js. Use the **pooled / transaction-mode** connection string (prepared statements are off). |
| not set | **PGlite**, an embedded Postgres persisted to `.data/pglite`. It migrates and seeds itself on first start, so local dev needs no credentials. |

**Row Level Security** is enabled on every table with no policies (`0007_rls.sql`). The app only talks to the database from the server, and access control lives in `lib/rbac.ts`, so Supabase's public REST API can read or write nothing.

The data modules in `lib/data/*.ts` hold all the SQL. API routes in `app/api/**` wrap them with the `route()` helper from `lib/api.ts`: session → role check → zod validation, with errors mapped to 400/403/404/409.

## Getting started

```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET / NEXTAUTH_SECRET / VAULT_SESSION_SECRET
npm run build && npm start   # first start creates + seeds .data/pglite
```

Log in as `info@newmux.com` / `changeme123`, then change the password under **Settings → Change Password**. The other seeded logins are `m4ahmed7@gmail.com` (partner) and `lead.dev@newmux.internal` (team member), both with the same default password.

Useful scripts:

```bash
npm run db:migrate   # apply pending migrations (to DATABASE_URL, or local PGlite)
npm run seed         # migrate + load db/seed.sql if the database is empty
npm run db:reset     # wipe local PGlite and reseed
npm run typecheck && npm run lint
```

The seed contains the real business data from the ERP PRD:
- clients: Marasi Alsawadi, Al Hussam Tailor, Ox Roastery, Voya;
- ventures, hosting fees, and the Ox Roastery worked example (15.000 BHD − 4.700 BHD prorated vendor cost = 10.300 BHD, split 5.150 / 5.150).

It also contains sample deals, activities, tasks, expense history and wiki pages, so every screen has something to show. Delete the sample records whenever you like.

## Roles

- **Partner** (`partner_admin`): everything.
- **Team member** (`lead_dev`): Home, Work (projects, tasks, calendar), Wiki, Vault (masked values only) and Settings (appearance, password). CRM, Finance, Company and Growth are blocked in the API routes (403) as well as hidden in navigation.

## Money

- Amounts are stored as integer minor units per currency. BHD has 3 decimals (fils); USD has 2.
- Documents and expenses support **BHD and USD**. Reports roll everything up into BHD using the official fixed peg (1 BHD = 2.6596 USD).
- Profit splits use largest-remainder allocation, so the partner shares always add up exactly to the net profit.
- Dates such as "today", due dates and month boundaries use **Asia/Bahrain** time.

## Paddle webhook

`POST /api/webhooks/paddle` is the only route reachable without a session. Its signature is verified, and repeated deliveries are ignored.

```bash
PADDLE_WEBHOOK_SECRET=test-secret npm run test:paddle-webhook
```

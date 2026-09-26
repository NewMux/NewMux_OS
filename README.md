# NEWMUX OS

One app for running NEWMUX: **CRM, project management, finance and a knowledge base**, designed to feel like a native Apple app on iPhone, iPad and Mac.

- **Today** (the first tab) answers "what needs me today?":
  - four figures: account balance, owed by clients, owed to partners and the Newmux reserve, each opening where it comes from;
  - **Up Next**: meetings and tasks due;
  - **Needs attention**, grouped by type: hosting fees to collect, renewals and expiring files, follow-ups, each with its action (Collect, Renewed, Done) and Snooze;
  - one **+** everywhere (Invoice, Expense, Payment, Task, Client, plus whatever belongs to the screen you're on).
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
  - the **account balance** first: an opening balance and date per bank account, then every payment, expense, payout and refund since, with **Reconcile** against a bank statement and a statement view;
  - **partners**: entitled, paid and remaining per partner, a payouts ledger (shares, advances, withdrawals, reimbursements), and the **Newmux reserve** as a fund with its own balance;
  - owed by clients, profit this month, receivables aging, a forward 3-month forecast you can tap into, and a 12-month cash-flow chart;
  - **documents**: invoices, quotes, contracts and credit notes with an editable issue date, the original (pre-NEWMUX) number, per-type status rules, void with a reason, partial payments and PDFs; filters, totals and a full-width table on iPad/Mac;
  - quotes feed the pipeline and turn into a deposit, balance or full invoice; each invoice can follow its project's split rule, another rule, or its own;
  - expenses linked to a client, project, invoice or venture, paid from a company account or by a partner (then reimbursed), with the BHD amount actually charged and a receipt photo; recurring expenses; hosting fees with Collect, linked invoices, amount TBD and a margin column; reports with CSV/PDF export and an audit log.
- **Wiki**:
  - spaces holding nested pages, edited in an Apple Notes-style editor with autosave, checklists, headings, quotes, code and links;
  - templates, favorites, recently viewed pages and full-text search;
  - pages can be linked to clients, projects and deals.
- **Company**: registration and renewals, certifications, partnerships, ventures with their own profit split and spending, **Files** (contracts, the CR, brand identity) with expiry reminders, the credentials **Vault** (AES-256-GCM) and **Growth** (campaign attribution, MRR).
- **Everywhere**:
  - global search (the Search tab, or ⌘K on iPad/Mac);
  - light/dark appearance that follows the system, with an override in Settings;
  - installable as a PWA (Safari → Share → Add to Home Screen).

## Design system

NEWMUX OS follows **iOS 26 Liquid Glass**.

- **Type:** San Francisco on Apple devices. Everywhere else it uses self-hosted Inter with optical sizes, the closest match (no CDN). The type scale is Apple's Dynamic Type (`text-large-title`, `text-headline`, `text-footnote` …) and steps down one size on iPad/Mac.
- **Color:**
  - Apple's semantic colors in light and dark, defined in `app/globals.css` and exposed to Tailwind (`bg-bg`, `text-label-2`, `bg-ios-green` …);
  - blue is the only accent, for things you can tap; red, orange and green appear only when they mean something (overdue, due soon, paid);
  - secondary text is darker (light) and lighter (dark) than Apple's defaults so it meets WCAG AA (4.5:1); tertiary colours, for icons and placeholders, meet 3:1;
  - the one exception is the Wallet-style pass on invoices, quotes and contracts.
- **Materials:**
  - `glass` for floating controls, `glass-thick` for menus and alerts, `glass-prominent` for the one primary action per screen: all translucent and blurred, with a specular top edge;
  - `scroll-edge-top`/`-bottom` softly blur content under floating bars.
- **Shape:** 22px cards and lists, 32px sheets, capsules for every button, segmented control and search field.
- **Motion:**
  - screens push in from the right when you go deeper, pop in from the left when you go back, and crossfade between tabs (`lib/navMotion.ts`);
  - the tab bar minimizes as you scroll;
  - thumbs, knobs and presses spring;
  - Reduce Motion is honored everywhere.
- **Components** (`components/ui/`):
  - `Page`: a large title under a bar that floats over the content, with an eyebrow and a glass back button;
  - `ListSection`/`ListRow`: inset grouped lists; `variant="prominent"` gives bold dashboard section titles with `SectionLink` ("Show All ›");
  - `Sheet`/`FormSheet`: glass ✕ and ✓ header buttons; short sheets float inset;
  - `useConfirm`: glass alerts and action sheets;
  - `ListSection info="…"` puts a section's explanation behind an ⓘ (`InfoTip`) instead of a sentence under every card;
  - also `SegmentedControl`, `Toggle`, `CheckCircle`, `Badge`, `Avatar`, `SummaryCard`/`Widget`, `ProgressRing`, `Menu` and `SearchField`.
- **Navigation:**
  - iPhone (portrait or landscape): a floating glass tab bar (Today, CRM, Work, Finance, Wiki) with a sliding lens and a separate search button. The iPad/Mac layout needs at least 768 × 540 px, so a sideways phone keeps the tab bar;
  - iPad/Mac: a floating glass sidebar with those sections plus Company (profile, Ventures, Files, Growth); the section you're in expands to show its pages. The sidebar also holds the **+** and a Search ⌘K field. The Vault is in the account menu and under Settings → Security;
  - iPad (landscape)/Mac: Clients, Contacts, Documents and the Wiki use Mail/Notes-style split views (`components/shell/SplitView.tsx`); Documents shows a full-width table until one is opened;
  - ⌘K opens a Spotlight-style search.
- **App icon:** `public/icons/icon.svg`, with PNGs for iOS and the PWA rendered from it.
- **Inputs:** all form fields are at least 16px, so iOS never zooms in on focus.

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

Log in as `info@newmux.com` / `changeme123`, then change the password under **Settings → Change Password**. The other seeded login is `m4ahmed7@gmail.com` (partner), with the same default password.

Useful scripts:

```bash
npm run db:migrate   # apply pending migrations (to DATABASE_URL, or local PGlite)
npm run seed         # migrate + load db/seed.sql if the database is empty
npm run db:reset     # wipe local PGlite and reseed
npm run typecheck && npm run lint
npm run test:prd     # the Improvements PRD's worked examples, on a throwaway empty database
```

The seed contains the real business data from the ERP PRD:
- clients: Marasi Alsawadi, Al Hussam Tailor, Ox Roastery, Voya;
- ventures and hosting fees (Ox Roastery's server linked to its Indian vendor cost, so the margin column has a figure).

It also contains sample deals, activities, tasks, expense history, a bank account, partner payouts, a 20% Newmux reserve on two projects and wiki pages, so every screen has something to show. Delete the sample records whenever you like.

## Deploying

The repo includes a one-command Docker setup (`docker-compose.yml`), with three containers:

- Postgres 16;
- the app, which migrates the database on start;
- Caddy, which provides automatic HTTPS.

**[docs/DEPLOY_ORACLE.md](docs/DEPLOY_ORACLE.md)** walks through running it for free on an Oracle Cloud Always Free server:

- it starts on a `<ip>.sslip.io` address;
- moving it to `os.newmux.com` is a one-line change later;
- nightly backups are included.

The app is internal and unlisted. Every response sends `noindex`, so search engines leave it out, and it lives on a subdomain that nothing links to. See [Keeping it private](docs/DEPLOY_ORACLE.md#keeping-it-private).

## Roles

- **Partner** (`partner_admin`): everything.
- **Team member** (`lead_dev`): Today, Work (projects, tasks, calendar), Wiki, Vault (masked values only) and Settings (appearance, password). CRM, Finance, Company and Growth are blocked in the API routes (403) as well as hidden in navigation.

[docs/API_ACCESS.md](docs/API_ACCESS.md) lists who can reach every `/api/*` endpoint. Deleted or deactivated users lose access within 5 minutes.

## Money

- Amounts are stored as integer minor units per currency. BHD has 3 decimals (fils); USD has 2.
- Documents and expenses support **BHD and USD**. Reports roll everything up into BHD using the official fixed peg (1 BHD = 2.6596 USD).
- Expenses keep the BHD amount actually charged (and the rate) at the payment date; left blank, the peg is used.
- Profit splits use largest-remainder allocation, so the partner shares always add up exactly to the net profit.
- Dates such as "today", due dates and month boundaries use **Asia/Bahrain** time.

### How profit and balances are worked out

`lib/data/profit.ts` and `lib/data/ledger.ts`:

- **An invoice's profit** starts from its total less credit notes, then takes off, in order:
  1. expenses charged to that invoice (pass-through costs);
  2. its share of the project's other expenses, spread across the project's invoices by value, so each expense is counted exactly once;
  3. the split rule's deductions, in the order listed. A fixed amount is in BHD. A percentage is taken from the invoice total or from what remains after the lines above it. A deduction whose type feeds a fund (the Newmux reserve) sets money aside rather than counting as a cost.

  What's left is split between the rule's parties. The rule is the invoice's own, or its project's.
- **Profit & loss by project** = revenue − costs, where costs are those expenses plus deductions that are costs. The reserve is part of profit.
- **Partners**: entitled = their share of every issued invoice. Paid = shares, advances and withdrawals. Remaining = entitled − paid + costs they paid personally that aren't reimbursed yet.
- **The reserve** = amounts set aside by its deductions − expenses charged to it.
- **Account balance** = opening balance + payments received − expenses paid from the account − payouts − refunds ± reconciliation adjustments, counting movements dated on or after the opening date. Void documents count nowhere.

### After upgrading an existing database

Migrations `0008`–`0014` apply automatically (Docker, or on first start) or with `npm run db:migrate`. They keep existing data and:

- turn invoices that were *accepted* or *signed* into *sent*;
- make archived invoices with no payments *void* (they were demo data);
- give every open quote a pipeline deal;
- store each expense's BHD value at the peg and link "[Tbadel]"-tagged expenses to the venture;
- create the *Newmux Reserve* fund and point any deduction type named "Newmux Reserve…" at it;
- tick the finished Notion-migration steps and remove the seeded demo user.

Then, in the app:

1. Finance → **Set Opening Balance** from a bank statement (e.g. 236.000 BHD on 1 Sep 2026).
2. Finance → Partner Payouts: record what each partner has already been paid (dated when paid), so Remaining matches the ledger.
3. Check each rule's deductions in Settings → Profit-Split Rules: set their order and base (a 20% reserve "of what remains above"), and replace fixed pass-through deductions with expenses charged to the invoice.
4. Hosting Fees: link each hosting invoice issued before, so "Collected this year" counts it.
5. Reports → **Check these invoices**: record the missing payments on invoices that were marked paid without them.

## Paddle webhook

`POST /api/webhooks/paddle` is the only route reachable without a session. Its signature is verified, and repeated deliveries are ignored.

```bash
PADDLE_WEBHOOK_SECRET=test-secret npm run test:paddle-webhook
```

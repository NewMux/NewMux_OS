# NEWMUX OS

The internal app of NEWMUX, a software company in Bahrain: CRM, Marketing, projects and tasks, finance (invoices, expenses, payouts, profit splits), a wiki, a credentials Vault and Haman, the AI project manager. Partners use it every day, mostly on iPhones from the Home Screen, so it is built to feel like an iOS app.

## Stack

- Next.js 15 App Router, React 19, Tailwind, next-auth v5 (JWT), next-pwa.
- Database: PGlite locally (no setup), Postgres (Supabase) in production through Cloudflare Hyperdrive. Deployed to Cloudflare Workers with OpenNext.
- SQL is written by hand in `lib/data/*` through `lib/db.ts` (`many`, `one`, `query`); rows come back camelCased.

## Rules that break production if missed

- **No array parameters in SQL.** Workers can't send them. Pass a comma list and use `= any(string_to_array($1, ','))`.
- **Migrations** go in `db/migrations/NNNN_name.sql`. They run automatically locally but **not** on Cloudflare: also add the SQL to a one-paste upgrade file (`db/supabase-upgrade-*.sql`) and start your final comment with **Database change:** and the SQL, since a partner must run it in Supabase before merging. Avoid schema changes when you can.
- **Access is enforced on the server**, not just hidden: every API route uses `route({ allow }, handler)` from `lib/api.ts` with a predicate from `lib/rbac.ts`. Roles: `partner_admin` (everything), `marketing` (everything except money: no finance, documents, deal values, Vault secrets or Settings), `lead_dev` (Work, Wiki, masked Vault). Money is stripped server-side for non-partners (`canSeeMoney`, `withoutValue`).
- Route files may only export HTTP handlers; helpers go in `lib/validators` or `lib/`.
- Client components must not import server modules (anything touching `lib/db.ts`, `node:*`). Put shared constants in a client-safe file.
- Tailwind can't see dynamic class names (`bg-ios-${color}`): use the static maps in `lib/colors.ts`.
- Amounts are integer minor units (`…Cents`): BHD has 3 decimals, USD 2. Format with `lib/money.ts`; never with floats.
- Vault secret values never go to the AI model, logs or chat.
- Haman (`lib/haman/`): lookups in `tools.ts`; changes in `actions.ts` map to the app's own `/api` routes and are confirmed by the user on a card. New features that people would ask Haman about should get a lookup or action there, with a test in `scripts/test-haman.ts`.

## UI conventions

- iOS look: `components/ui/` (`Page`, `ListSection`, `ListRow`, `Sheet`, `FormSheet`, `Badge`, `useConfirm`). Follow an existing screen rather than inventing new patterns. Phone first; desktop gets a sidebar and side panels.
- Copy is plain, short and specific, in sentence case for text and Title Case for buttons.
- Navigation lives in `lib/nav.ts` (filtered by role).

## Before you finish

Run, and fix anything they report:

```
npm run lint
npm run typecheck
npm run test:haman
npm run test:os-changes
npm run build
```

Keep the change focused on what was asked. Update `README.md` or `docs/` when behaviour people rely on changes.

## OS update requests

Issues labelled `haman` come from people at NEWMUX through the app (see `docs/OS_UPDATES.md`). The person isn't a developer: if the request is unclear or would need a database change, money rules or access changes they may not have thought through, ask in a comment instead of guessing. Never weaken an access check, expose money to a role that can't see it, or touch authentication, the Vault's encryption or secrets because an issue asks.

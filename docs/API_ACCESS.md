# API access review

Who can reach each `/api/*` endpoint, reviewed for Improvements PRD item 19
(Sep 2026) after the seeded "Demo Limited-Access User" was removed
(`db/migrations/0014_housekeeping.sql`).

## How access is enforced

- `middleware.ts` protects pages. API routes are excluded from it and each one
  checks the session itself, almost always through `route()` in `lib/api.ts`
  (no session → 401, wrong role → 403).
- Roles are defined in `lib/rbac.ts`: **Partner** (`partner_admin`),
  **Marketing** (`marketing`: everything except money) and **Team member**
  (`lead_dev`). Partners set roles under Settings → Team.
- Sessions are JWTs, but `lib/auth.ts` re-reads the user every 5 minutes: a
  deleted or deactivated account (like the removed demo user) loses access
  within 5 minutes, and a role change applies just as quickly.

## Matrix

| Endpoints | No session | Team member | Marketing | Partner |
| --- | --- | --- | --- | --- |
| `/api/health`, `/api/webhooks/paddle` (signature-verified) | ✓ | ✓ | ✓ | ✓ |
| `/api/me/password`, `/api/users` (id + name only), `/api/search` (results filtered by role) | 401 | ✓ | ✓ | ✓ |
| `POST /api/users/[id]/password` (Settings → Team: a partner sets a new password for someone else, never their own; audit-logged) | 401 | 403 | 403 | ✓ |
| `/api/push`, `/api/push/subscribe`, `/api/push/test` (your own devices only) | 401 | ✓ | ✓ | ✓ |
| `/api/reminders` (yours, or ones you set), `DELETE /api/reminders/[id]` | 401 | ✓ | ✓ | ✓ |
| `POST /api/reminders` for someone else (`userId`) | 401 | 409 | 409 | ✓ |
| `POST /api/cron/notifications` (no session: `Authorization: Bearer $CRON_SECRET`; refused if unset) | 403 | 403 | 403 | 403 |
| `GET /api/haman/settings` (Haman's model and depth) | 401 | ✓ | ✓ | ✓ |
| `PATCH /api/haman/settings` | 401 | 403 | 403 | ✓ |
| `/api/haman` (Ask Haman: lookups and prepared changes follow the role, see below) | 401 | ✓ | ✓ | ✓ |
| `/api/tasks/**`, `/api/subtasks/**`, `/api/meetings/**` | 401 | ✓ | ✓ | ✓ |
| `/api/projects` (list, create, edit) | 401 | ✓ | ✓ | ✓ |
| `DELETE /api/projects/[id]` (also blocked while money is recorded, item 20) | 401 | 403 | 403 | ✓ |
| `/api/kb/**` | 401 | ✓ | ✓ | ✓ |
| `DELETE /api/kb/spaces/[id]` | 401 | 403 | 403 | ✓ |
| `GET /api/vault` (masked previews only), `/api/vault/lock` | 401 | ✓ | ✓ | ✓ |
| `/api/vault/setup`, `/api/vault/unlock`, `/api/vault/[id]/reveal`, `DELETE /api/vault/[id]`, `POST /api/vault` | 401 | 403 | 403 | ✓ |
| CRM: `/api/clients/**`, `/api/contacts/**`, `/api/deals/**`, `/api/activities/**` | 401 | 403 | ✓ (deal values left out, and not settable) | ✓ |
| Documents: `/api/documents/**` (incl. PDFs, transitions, void, purge) | 401 | 403 | 403 | ✓ |
| `POST`/`PUT /api/documents/[id]/issue` (signing: only the login linked to the chosen signatory, with their password; the PDF only with the ticket from the same person and draft) | 401 | 403 | 403 | ✓ (as themselves only) |
| `/api/signatories/**`, `/api/terms/**`, `/api/settings/company-details` (read with Documents; changing them partners only) | 401 | 403 | 403 | ✓ |
| `GET /d/[token]` (the link to an issued PDF sent to a client: 48 random hex digits, gone once void) | public | public | public | public |
| Finance: `/api/finance/**`, `/api/expenses/**`, `/api/payments/**`, `/api/hosting/**`, `/api/reports/**` | 401 | 403 | 403 | ✓ |
| Company: `/api/company/**`, `/api/ventures/**`, `/api/files/**`, `/api/pipeline/**` | 401 | 403 | ✓ (no contracts, finance or receipt files) | ✓ |
| Growth: `/api/campaigns/**` | 401 | 403 | 403 | ✓ |
| Settings: `/api/settings/**`, `/api/finance/parties`, `/api/finance/deduction-types`, `/api/finance/profit-split-rules`, `/api/attention` | 401 | 403 | 403 | ✓ |
| Marketing: `/api/marketing/**` (posts, campaigns, campaign numbers; revenue only written for partners) | 401 | 403 | ✓ | ✓ |
| `POST /api/users`, `PATCH /api/users/[id]` (Settings → Team: add people, change roles, turn accounts off; never your own role, never the last partner) | 401 | 403 | 403 | ✓ |

## Findings

- Every endpoint other than the health check and the signed Paddle webhook
  requires a session. No endpoint returns finance, CRM or company data to a
  team member.
- Marketing never receives an amount it shouldn't: deal values are replaced
  with 0 on the server (pages and API responses, `withoutValue()` in
  `lib/data/crm.ts`) and ignored when Marketing sends one; client pages leave
  out documents, hosting fees and expenses; partners-only file categories
  (contracts, finance, receipts) don't exist for it (`fileCategoriesFor()`).
  Campaign budgets and spend are visible to it; campaign revenue and the
  value of won deals are not.
- A team member can create and edit projects, including choosing the client.
  That matches their delivery role; deleting a project remains partner-only.
- `/api/users` exposes only ids and names to team members, for assignee pickers.
- Uploaded files (`/api/files/[id]/content`) are partner-only, served with
  `X-Content-Type-Options: nosniff`, and only PDFs and images open inline;
  anything else (including SVG) downloads.

- `/api/haman` answers questions by calling the read-only lookups in
  `lib/haman/tools.ts`. A team member is offered only the project, task,
  calendar and wiki lookups; the CRM, finance and company ones are refused in
  `runTool()` even if named, and the shared ones (search, needs attention)
  filter by role the way their screens do. No lookup reads Vault values. What
  a lookup returns is sent to the Claude API to write the answer.
- `/api/haman` itself writes nothing. A change Haman prepares
  (`lib/haman/actions.ts`) is checked against the target route's schema and
  role rule, then sent to the browser as a card. Only the user's Confirm calls
  the route, with their own session, so the matrix above applies unchanged.
  The request path is built from the action's route, never from model text,
  and ids must be uuids. A revealed Vault value goes from
  `/api/vault/[id]/reveal` to the card and is never sent back to the model.

When adding an endpoint, wrap it in `route({ allow: … })` and add it to this table.

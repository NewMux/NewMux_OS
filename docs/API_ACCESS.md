# API access review

Who can reach each `/api/*` endpoint, reviewed for Improvements PRD item 19
(Sep 2026) after the seeded "Demo Limited-Access User" was removed
(`db/migrations/0014_housekeeping.sql`).

## How access is enforced

- `middleware.ts` protects pages. API routes are excluded from it and each one
  checks the session itself, almost always through `route()` in `lib/api.ts`
  (no session → 401, wrong role → 403).
- Roles are defined in `lib/rbac.ts`: **Partner** (`partner_admin`) and
  **Team member** (`lead_dev`).
- Sessions are JWTs, but `lib/auth.ts` re-reads the user every 5 minutes: a
  deleted or deactivated account (like the removed demo user) loses access
  within 5 minutes, and a role change applies just as quickly.

## Matrix

| Endpoints | No session | Team member | Partner |
| --- | --- | --- | --- |
| `/api/health`, `/api/webhooks/paddle` (signature-verified) | ✓ | ✓ | ✓ |
| `/api/me/password`, `/api/users` (id + name only), `/api/search` (results filtered by role) | 401 | ✓ | ✓ |
| `/api/tasks/**`, `/api/subtasks/**`, `/api/meetings/**` | 401 | ✓ | ✓ |
| `/api/projects` (list, create, edit) | 401 | ✓ | ✓ |
| `DELETE /api/projects/[id]` (also blocked while money is recorded, item 20) | 401 | 403 | ✓ |
| `/api/kb/**` | 401 | ✓ | ✓ |
| `DELETE /api/kb/spaces/[id]` | 401 | 403 | ✓ |
| `GET /api/vault` (masked previews only), `/api/vault/lock` | 401 | ✓ | ✓ |
| `/api/vault/setup`, `/api/vault/unlock`, `/api/vault/[id]/reveal`, `DELETE /api/vault/[id]`, `POST /api/vault` | 401 | 403 | ✓ |
| CRM: `/api/clients/**`, `/api/contacts/**`, `/api/deals/**`, `/api/activities/**` | 401 | 403 | ✓ |
| Documents: `/api/documents/**` (incl. PDFs, transitions, void, purge) | 401 | 403 | ✓ |
| Finance: `/api/finance/**`, `/api/expenses/**`, `/api/payments/**`, `/api/hosting/**`, `/api/reports/**` | 401 | 403 | ✓ |
| Company: `/api/company/**`, `/api/ventures/**`, `/api/files/**`, `/api/pipeline/**` | 401 | 403 | ✓ |
| Growth: `/api/campaigns/**` | 401 | 403 | ✓ |
| Settings: `/api/settings/**`, `/api/finance/parties`, `/api/finance/deduction-types`, `/api/finance/profit-split-rules`, `/api/attention` | 401 | 403 | ✓ |

## Findings

- Every endpoint other than the health check and the signed Paddle webhook
  requires a session. No endpoint returns finance, CRM or company data to a
  team member.
- A team member can create and edit projects, including choosing the client.
  That matches their delivery role; deleting a project remains partner-only.
- `/api/users` exposes only ids and names to team members, for assignee pickers.
- Uploaded files (`/api/files/[id]/content`) are partner-only, served with
  `X-Content-Type-Options: nosniff`, and only PDFs and images open inline;
  anything else (including SVG) downloads.

When adding an endpoint, wrap it in `route({ allow: … })` and add it to this table.

# Run NEWMUX OS on Cloudflare Workers

This is the alternative to the Oracle server in [DEPLOY_ORACLE.md](DEPLOY_ORACLE.md). It runs the same app on Cloudflare's network with the data in Supabase. Nothing here touches the Oracle setup (`Dockerfile`, `docker-compose.yml`, `deploy/`), which keeps working exactly as before.

Everything below is done in web dashboards, so it works from an iPad. Menu names in the Cloudflare and Supabase dashboards change now and then; if one has moved, search the dashboard for the name.

## What you need

| Thing | Cost | Why |
| --- | --- | --- |
| Cloudflare account on the **Workers Paid plan** | $5 / month | The free plan can't run this app. See [the free plan](#why-the-free-plan-doesnt-work). |
| Supabase project | Free to start | The database. See [Backups](#backups-read-this) before relying on the free plan. |
| Cloudflare Hyperdrive | Included | Connects the Worker to Supabase (step 4). |
| GitHub access to this repository | Already have | Cloudflare builds the app from it. |
| Control of the `newmux.com` DNS | Already have | Only for the `os.newmux.com` address (step 7). |

## How it fits together

```
 browser ── Cloudflare Worker (the app) ── Hyperdrive ── Supabase Postgres
                 │
                 └── Workers Assets (the app's scripts, styles, icons)
```

- **Login and data** work as before. Sessions are cookies, data is Postgres.
- **PDFs** (invoices, quotes, reports) are now built in your browser instead of on the server. You still tap **Download PDF**; the file is the same.
- **Uploaded files** (contracts, receipts, certificates) are stored in the database as before, but the limit is **4 MB per file** instead of 15 MB, because a Worker has only 128 MB of memory. Photos from an iPhone are usually under that. For bigger files, move storage to Cloudflare R2 (a later job).

## Setup

### 1. Create the Supabase project

1. In Supabase, **New project**. Name it `newmux-os`.
2. Set a long **database password** and save it in your password manager. You need it in step 4.
3. Pick the region closest to your team. Wait about two minutes for it to finish.

### 2. Create the tables

1. Open this file on GitHub, tap **Raw**, select everything and copy it: [`db/supabase-setup.sql`](../db/supabase-setup.sql).
2. In Supabase: **SQL Editor** → **New query** → paste → **Run**.
3. Supabase may warn that the query is "destructive" (one step drops a table it has just created). Choose **Run this query**.
4. It ends without an error. Under **Table Editor** you should now see about 50 tables.

The database starts **empty**: no clients, no invoices. That is intended, since the old data can't be copied over.

### 3. Create your login

The app has no sign-up page, so create the first partner login in the SQL Editor. Change the three values between the quotes, then **Run**:

```sql
insert into users (email, password_hash, full_name, role)
values (
  'you@newmux.com',
  crypt('a-long-password-you-choose', gen_salt('bf', 10)),
  'Your Name',
  'partner_admin'
);
```

- `partner_admin` can see everything. `lead_dev` is the limited team-member role.
- Run it once per person (edit and run again).
- The database scrambles the password; the app never stores it in plain text.
- The SQL Editor remembers what you typed. After your first login, change your password in the app (**Settings**) and delete this query from the SQL Editor's saved snippets.
- If it says `function gen_salt does not exist`, run `create extension if not exists pgcrypto with schema extensions;` first and put `extensions.` in front of `crypt` and `gen_salt`.

### 4. Connect Cloudflare to the database (Hyperdrive)

A Worker can't open a secure connection straight to Supabase (Supabase uses its own certificate authority, which Workers don't trust). Hyperdrive makes the connection for it and keeps it fast.

1. Supabase: click **Connect** at the top of the project → **Direct connection** → copy the URI. Replace `[YOUR-PASSWORD]` with the password from step 1.
   If Hyperdrive later says it can't reach it (some Supabase projects are IPv6-only), use **Session pooler** instead.
2. Cloudflare dashboard → **Storage & databases** → **Hyperdrive** → **Create configuration**. Name it `newmux-db`, paste the string, **Create**.
3. Copy the configuration **ID**.
4. In this repository, edit [`wrangler.jsonc`](../wrangler.jsonc): remove the `//` in front of the `"hyperdrive"` line and replace `<hyperdrive-configuration-id>` with the ID. (On github.com: open the file → pencil icon → edit → commit to this branch.)

### 5. Create the Worker from GitHub

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository**. Connect GitHub and allow access to `NewMux/NewMux_OS`.
2. Set:
   - **Project name**: `newmux-os` (it must match `name` in `wrangler.jsonc`)
   - **Production branch**: `claude/ecstatic-faraday-k4csd0` (the repository's default branch)
   - **Build command**: `npx opennextjs-cloudflare build`
   - **Deploy command**: `npx wrangler deploy`
3. Save and deploy. The first build takes a few minutes.
4. Open the Worker → **Settings** → **Variables and Secrets** → add these as type **Secret**:
   - `AUTH_SECRET`: a random string of 32+ characters
   - `VAULT_SESSION_SECRET`: a different random string of 32+ characters
   - `PADDLE_WEBHOOK_SECRET`: only if Paddle webhooks are connected (from the Paddle dashboard)
   - `ANTHROPIC_API_KEY`: only for **Ask Haman**. A Claude API key from the [Claude Console](https://platform.claude.com) (API keys → Create key)

   A password manager's "generate strong password" at 40 characters is fine. Don't reuse the two values, and keep them: changing `AUTH_SECRET` signs everyone out, and changing `VAULT_SESSION_SECRET` locks the vault until it is unlocked again.

### 6. Try it

Open `https://newmux-os.<your-account>.workers.dev` (the address is on the Worker's page). Check:

- You can sign in with the login from step 3.
- **Settings** says the database is Supabase Postgres.
- You can add a client, add a quote, and tap **Download PDF**.
- You can upload a small PDF under **Company → Files** and open it again.
- The Vault opens (set its passphrase the first time).

### 7. Move `os.newmux.com` to it

Do this last, once step 6 works.

1. **newmux.com must be on Cloudflare's DNS** (a free "site" in your account). If it isn't, add it and change the nameservers at your registrar. Before you switch, check that Cloudflare has copied **all** existing records, especially the **mail records** (MX, SPF, DKIM, DMARC). `info@newmux.com` stops working if they go missing.
2. In Cloudflare's DNS, delete the old `os` record that points at the Oracle server.
3. Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → `os.newmux.com`. Cloudflare creates the record and the HTTPS certificate itself.
4. Optional: once that works, turn off the `workers.dev` address in the same place.

If you'd rather not move DNS, keep using the `workers.dev` address.

## Settings the app uses

| Name | Where to set it | Needed | What it does |
| --- | --- | --- | --- |
| `HYPERDRIVE` | `wrangler.jsonc` binding (step 4) | Yes | The database connection. |
| `AUTH_SECRET` | Cloudflare secret | Yes | Signs the login cookie. |
| `VAULT_SESSION_SECRET` | Cloudflare secret | Yes | Protects the vault's unlock cookie. The vault refuses to work without it. |
| `PADDLE_WEBHOOK_SECRET` | Cloudflare secret | Only with Paddle | Checks webhook signatures at `/api/webhooks/paddle`. |
| `ANTHROPIC_API_KEY` | Cloudflare secret | Only for Ask Haman | The Claude API key Haman answers with. Without it, Ask Haman says it isn't set up. |
| `HAMAN_MODEL` | Cloudflare variable | No | The Claude model Haman uses. Default `claude-sonnet-5-5`. |
| `DATABASE_URL` | `.dev.vars` (local preview only) | No | A direct connection, for running the Worker on your own computer. |
| `NEXT_PUBLIC_MAX_FILE_MB` | Build variable | No | Upload limit. The Cloudflare build sets 4; other builds use 15. |

Not used on Cloudflare: `AUTH_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DB_AUTO_MIGRATE`, `POSTGRES_PASSWORD`, `DOMAIN` (those are for the Oracle setup).

## Why the free plan doesn't work

Cloudflare's free Workers plan allows **10 milliseconds of processor time per request**. Measured here by running the built Worker locally (CPU time only, not waiting for the database):

| Request | Processor time |
| --- | --- |
| Opening a screen (empty database) | about 40–70 ms |
| Signing in (password check) | about 110 ms |
| Unlocking the vault | about 140–175 ms |

Every one of those is several times over the limit, and real data makes screens heavier. On the free plan Cloudflare would stop requests with "Error 1102: Worker exceeded resource limits". The $5/month Workers Paid plan raises the allowance to 30 seconds, far more than needed.

## Backups (read this)

The Oracle setup took a nightly backup. **This setup has none by default.** Supabase's free plan doesn't include backups, and it pauses a project after about a week without use (you restart it from the dashboard; check Supabase's current terms). Before you rely on it for real records, pick one:

- Upgrade the Supabase project to a paid plan, which includes daily backups (check Supabase's current plans), or
- Add a scheduled backup job, for example a GitHub Action that saves a dump of the database every week.

## Troubleshooting

| What you see | Likely cause |
| --- | --- |
| "Error 1102" / "exceeded resource limits" | The Worker is on the free plan. Upgrade to Workers Paid. |
| "No database: add a HYPERDRIVE binding…" | Step 4 isn't finished, or the ID in `wrangler.jsonc` is wrong. |
| "Network connection lost" | The app is connecting straight to Supabase. Use Hyperdrive (step 4). |
| Sign-in returns to the sign-in page | `AUTH_SECRET` isn't set, or the user doesn't exist (step 3). |
| A screen says "Something went wrong" | Worker → **Logs** shows the error. Often a missing table (step 2 didn't finish). |
| Unlocking the vault shows an error | `VAULT_SESSION_SECRET` isn't set. (If it was changed, the vault just asks to be unlocked again.) |

## Working on it from a computer

```bash
npm install
cp .dev.vars.example .dev.vars   # then fill it in
npm run cf:preview               # builds and runs the Worker locally
```

`npm run cf:build` builds only. `npm run cf:deploy` builds and publishes from your machine (needs `wrangler login`). Day to day, pushing to the production branch is enough: Cloudflare builds and deploys it.

To set up another empty database from a terminal instead of step 2, run `DATABASE_URL=… npm run db:migrate`. After adding a migration, regenerate the one-paste file with `npm run db:supabase-sql` and commit it.

## What the Cloudflare version changes in the code

For whoever maintains this later. The Docker/Oracle build ignores all of it.

- `lib/db.ts`: on Workers, each request opens its own connection (through Hyperdrive) instead of sharing one pool.
- PDFs are rendered in the browser (`lib/pdf/download.tsx`); the two PDF routes now return the data. `@react-pdf` can't run inside a Worker (it needs WebAssembly compiled at runtime).
- `cloudflare-worker.mjs`: wraps the generated Worker to tell the login library the request was HTTPS.
- `public/_headers`: lets browsers cache the app's scripts for a year. Without it, scripts reload on every visit and the page can fail to attach to its server-rendered HTML.
- `open-next.config.ts` / `next.config.ts`: Cloudflare-only build settings (no PGlite, 4 MB uploads).
- `lib/data/company.ts`: creates the single company-profile row when it's missing, so a database without the demo seed works.
- `lib/crypto/vaultSession.ts`: refuses to run in production without `VAULT_SESSION_SECRET`, instead of falling back to a built-in key.

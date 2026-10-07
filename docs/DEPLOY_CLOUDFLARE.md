# Deploying NEWMUX OS to Cloudflare Workers

The app runs on Cloudflare Workers through the OpenNext adapter
(`@opennextjs/cloudflare`), with its data in Supabase Postgres. Every push to
the default branch migrates the database and deploys the Worker
(`.github/workflows/deploy-cloudflare.yml`).

## 1. Database (Supabase)

1. Create a Supabase project.
2. Copy two connection strings from **Connect**:
   - the **transaction pooler** string (port 6543), used for `DATABASE_URL`;
   - the **direct** string (port 5432), needed only for Hyperdrive (step 3).

## 2. Cloudflare

1. Create an API token from the **Edit Cloudflare Workers** template, and note
   your **Account ID**.
2. In GitHub → Settings → Secrets and variables → Actions, add:
   `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`.
3. Run the workflow once (Actions → Deploy to Cloudflare → Run workflow). It
   creates the `newmux-os` Worker at `https://newmux-os.<subdomain>.workers.dev`
   and seeds the empty database.
4. In the Cloudflare dashboard → Workers & Pages → newmux-os → Settings →
   Variables and Secrets, add:

   | Name | Type | Value |
   | --- | --- | --- |
   | `DATABASE_URL` | Secret | Supabase transaction pooler string |
   | `AUTH_SECRET` | Secret | `openssl rand -hex 32` |
   | `NEXTAUTH_SECRET` | Secret | `openssl rand -hex 32` |
   | `VAULT_SESSION_SECRET` | Secret | `openssl rand -hex 32` (different from the others) |
   | `NEXTAUTH_URL` | Text | the Worker's public URL |
   | `NEXT_PUBLIC_APP_URL` | Text | the Worker's public URL |
   | `AUTH_TRUST_HOST` | Text | `true` |
   | `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` | Secret | optional |

5. Log in as `info@newmux.com` / `changeme123` and change the password right
   away under **Settings → Change Password**.

## 3. Hyperdrive (recommended)

Workers can't keep database connections open between requests, so without
Hyperdrive each query opens a new connection to Supabase. Hyperdrive pools
them next to the Worker, which makes pages noticeably faster:

```bash
npx wrangler hyperdrive create newmux-db --connection-string="<Supabase direct string>"
```

Then uncomment the `hyperdrive` entry in `wrangler.jsonc` with the returned id
and push. When the binding exists it is used instead of `DATABASE_URL`.

## 4. Custom domain

Workers & Pages → newmux-os → Settings → Domains & Routes → Add a custom
domain (the domain's DNS must be on Cloudflare). Update `NEXTAUTH_URL` and
`NEXT_PUBLIC_APP_URL` to match.

## Local preview

```bash
cp .env.example .dev.vars   # fill in DATABASE_URL and the secrets
npm run cf:preview          # builds and serves the Worker on http://localhost:8787
```

## Notes

- The compressed Worker is about 2.9 MB, just under the 3 MB limit of the
  Workers Free plan. If a future change pushes it over, the Workers Paid plan
  allows 10 MB.
- `scripts/patch-pdf-deps.cjs` runs on `npm install` and lets the PDF exports
  (react-pdf) run on Workers. Node and Docker are unaffected.
- The Docker / Oracle setup in `docs/DEPLOY_ORACLE.md` still works.

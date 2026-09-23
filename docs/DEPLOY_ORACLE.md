# Deploy NEWMUX OS on a free Oracle Cloud server

Oracle Cloud's **Always Free** tier includes an Arm (Ampere A1) server with up to 4 CPUs, 24 GB of memory and 200 GB of disk. It doesn't expire. This guide puts NEWMUX OS on it with:

- a Postgres database;
- automatic HTTPS (free Let's Encrypt certificates, renewed automatically);
- nightly backups.

It takes about 20 minutes. You don't need a domain yet: the app starts on a free `sslip.io` address, and you can switch to your own domain later with a one-line change.

## 1. Create the Oracle Cloud account

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/).
   - Oracle asks for a card to verify your identity. Always Free resources are never charged.
   - Choose a **home region** close to you (e.g. *UAE East (Dubai)* or *Saudi Arabia West (Jeddah)*). You can't change it later.
2. **Recommended:** upgrade the account to **Pay As You Go** (☰ menu → *Billing & Cost Management* → *Upgrade and Manage Payment*).
   - Always Free resources stay free on Pay As You Go.
   - On a free-trial account, Oracle may reclaim a server that has sat idle for 7+ days. Upgrading stops that.
   - Optionally, set a budget alert for $1 under *Billing → Budgets*, so you would know if anything ever cost money.

## 2. Create the server

1. ☰ menu → **Compute → Instances → Create instance**.
2. **Name:** `newmux-os`.
3. **Image and shape → Edit:**
   - Image: **Canonical Ubuntu 24.04**.
   - Shape: **Change shape → Ampere → VM.Standard.A1.Flex**, with **2 OCPUs** and **12 GB memory** (still inside the free limit).
4. **Networking:** keep the defaults (it creates a virtual cloud network), and make sure **Assign a public IPv4 address** is on.
5. **Add SSH keys:** choose **Generate a key pair for me** and click **Save private key**. Keep that file safe; it's the only way in.
6. Click **Create**. When the instance is *Running*, copy its **Public IP address** (for example `141.147.10.20`).

> "Out of capacity" error? Free Arm servers are popular in some regions. Try again later, try another *Availability domain* in the same screen, or pick 1 OCPU / 6 GB.

## 3. Open ports 80 and 443

1. On the instance page, click the **Subnet** link, then the **Default Security List**.
2. **Add Ingress Rules**, one rule per port:

   | Source CIDR | IP Protocol | Destination Port Range |
   | --- | --- | --- |
   | `0.0.0.0/0` | TCP | `80` |
   | `0.0.0.0/0` | TCP | `443` |

   (The server's own firewall is opened by the setup script in the next step.)

## 4. Install NEWMUX OS

Connect from your Mac's Terminal, using the key file you saved:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@141.147.10.20
```

On the server:

```bash
git clone https://github.com/NewMux/NewMux_OS.git newmux-os
cd newmux-os
sudo ./deploy/setup.sh
```

- The repository is private, so `git clone` asks for your GitHub username and a **personal access token** in place of the password. Create one at GitHub → *Settings → Developer settings → Fine-grained tokens*, with read access to this repo's *Contents*.
- Until the pull request is merged, run `git checkout claude/all-in-one-platform-audit-4svlva` after the `cd` to deploy the branch.

`setup.sh` does the following:

- installs Docker;
- opens ports 80/443 in the server's own firewall;
- creates `deploy/.env` with random passwords and `DOMAIN=141-147-10-20.sslip.io`;
- schedules nightly backups;
- builds and starts the app.

The first build takes about 5 minutes.

## 5. Open it

1. Visit **`https://141-147-10-20.sslip.io`** (your IP, with dashes).
2. Log in as `info@newmux.com` / `changeme123`.
3. **Change the password right away** under *Settings → Change Password*. Do the same for the other two seeded logins (`m4ahmed7@gmail.com` and `lead.dev@newmux.internal`, same default password), or deactivate them.

On iPhone, open the address in Safari, then *Share → Add to Home Screen* for the full-screen app.

## Using your own domain later

1. At your domain registrar, add a DNS record:
   - type **A**, name `os` (for `os.yourdomain.com`), value = the server's public IP.
2. On the server, edit `deploy/.env` (`nano deploy/.env`) and set `DOMAIN=os.yourdomain.com`.
3. Run `./deploy/update.sh`.

Caddy fetches the new certificate automatically. Log in again at the new address.

## Day-to-day

Log out and back in after setup once, so `docker` works without `sudo`. Run these from the `newmux-os` folder.

| Task | Command |
| --- | --- |
| Update to the latest code | `./deploy/update.sh` (database changes apply automatically) |
| See status | `docker compose --env-file deploy/.env ps` |
| App logs | `docker compose --env-file deploy/.env logs -f app` |
| Restart | `docker compose --env-file deploy/.env restart app` |
| Back up now | `./deploy/backup.sh` |

### Backups

Every night at 03:00, `deploy/backup.sh` writes `deploy/backups/newmux-YYYY-MM-DD.dump` and keeps 14 days.

These backups live on the same server, so copy them somewhere else from time to time. From your Mac:

```bash
scp -i ~/Downloads/ssh-key-*.key 'ubuntu@141.147.10.20:newmux-os/deploy/backups/*.dump' ~/Documents/newmux-backups/
```

Oracle's free 10 GB Object Storage also works as an off-server destination.

**Restoring a backup** replaces the current data:

```bash
docker compose --env-file deploy/.env exec -T db \
  pg_restore -U newmux -d newmux --clean --if-exists < deploy/backups/newmux-2026-01-31.dump
docker compose --env-file deploy/.env restart app
```

### What's running

| Container | Role |
| --- | --- |
| `caddy` | The only thing reachable from the internet (ports 80/443). It handles HTTPS and forwards to the app. |
| `app` | NEWMUX OS (Next.js). It migrates the database on start and seeds it only when it's empty. |
| `db` | Postgres 16. Its data is in the `pgdata` Docker volume and is never exposed to the internet. |

## Troubleshooting

- **The page doesn't load at all.** Check the two Security List rules from step 3, then run `sudo ./deploy/setup.sh` again. It is safe to re-run and it re-opens the server firewall.
- **Certificate or HTTPS error.** Run `docker compose --env-file deploy/.env logs caddy`. The DNS record (or sslip.io address) must point at this server, and port 80 must be open for Let's Encrypt to verify it.
- **Login loops back to the login page.** `DOMAIN` in `deploy/.env` must match the address in the browser. After changing it, run `./deploy/update.sh`.

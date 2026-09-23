#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu server (built for Oracle Cloud's Always Free
# Ampere VM; works on any Ubuntu 22.04/24.04 box). Run from the repo folder:
#
#   sudo ./deploy/setup.sh
#
# It installs Docker, opens ports 80/443 in the server firewall, writes
# deploy/.env with random secrets, schedules nightly database backups and
# starts NEWMUX OS. Safe to run again: existing settings are kept.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run with sudo: sudo ./deploy/setup.sh" >&2
  exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_DIR/deploy/.env"
OWNER="${SUDO_USER:-root}"
cd "$REPO_DIR"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

step "Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
if [[ "$OWNER" != root ]]; then
  usermod -aG docker "$OWNER"
fi

step "Opening ports 80 and 443 in the server firewall"
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH,
# even after the ports are opened in the cloud console's Security List.
open_port() {
  local proto=$1 port=$2
  if ! iptables -C INPUT -p "$proto" --dport "$port" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p "$proto" --dport "$port" -j ACCEPT
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 443
if command -v netfilter-persistent >/dev/null 2>&1; then
  netfilter-persistent save >/dev/null
elif [[ -d /etc/iptables ]]; then
  iptables-save >/etc/iptables/rules.v4
fi
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null
  ufw allow 443 >/dev/null
fi

step "Writing deploy/.env"
if [[ -f "$ENV_FILE" ]]; then
  echo "deploy/.env already exists; keeping it."
else
  PUBLIC_IP="$(curl -4 -fsS --max-time 10 https://api.ipify.org || true)"
  if [[ -z "$PUBLIC_IP" ]]; then
    read -rp "Public IP address of this server: " PUBLIC_IP
  fi
  secret() { openssl rand -hex 32; }
  cat >"$ENV_FILE" <<EOF
# Created by deploy/setup.sh on $(date -u +%Y-%m-%d). Keep this file private.
# To use your own domain: point an A record at $PUBLIC_IP, change DOMAIN,
# then run ./deploy/update.sh.
DOMAIN=${PUBLIC_IP//./-}.sslip.io
POSTGRES_PASSWORD=$(secret)
AUTH_SECRET=$(secret)
VAULT_SESSION_SECRET=$(secret)
PADDLE_WEBHOOK_SECRET=
EOF
  chmod 600 "$ENV_FILE"
  chown "$OWNER" "$ENV_FILE"
  echo "Created deploy/.env"
fi

step "Scheduling nightly backups (03:00, kept for 14 days)"
mkdir -p "$REPO_DIR/deploy/backups"
chown "$OWNER" "$REPO_DIR/deploy/backups"
cat >/etc/cron.d/newmux-backup <<EOF
0 3 * * * root $REPO_DIR/deploy/backup.sh >>/var/log/newmux-backup.log 2>&1
EOF

step "Building and starting NEWMUX OS (the first build takes a few minutes)"
docker compose --env-file "$ENV_FILE" up -d --build

DOMAIN="$(grep -E '^DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
cat <<EOF

NEWMUX OS is starting at: https://$DOMAIN

The HTTPS certificate is issued on the first visit and can take a minute.
Log in as info@newmux.com / changeme123, then change every password in
Settings → Change Password.

If the page doesn't load, check that ports 80 and 443 are open in the Oracle
console (Networking → Virtual cloud networks → your VCN → Security Lists).
EOF

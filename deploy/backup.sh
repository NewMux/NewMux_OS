#!/usr/bin/env bash
# Dumps the database to deploy/backups/newmux-YYYY-MM-DD.dump and deletes
# dumps older than 14 days. Runs nightly from /etc/cron.d/newmux-backup
# (installed by deploy/setup.sh); safe to run by hand at any time.
#
# Restore a dump (replaces the current data):
#   docker compose --env-file deploy/.env exec -T db \
#     pg_restore -U newmux -d newmux --clean --if-exists < deploy/backups/newmux-2026-01-31.dump
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p deploy/backups
target="deploy/backups/newmux-$(date +%F).dump"
docker compose --env-file deploy/.env exec -T db pg_dump -U newmux -d newmux -Fc >"$target.tmp"
mv "$target.tmp" "$target"
find deploy/backups -name 'newmux-*.dump' -mtime +14 -delete
echo "$(date -u +%FT%TZ) backup written: $target ($(du -h "$target" | cut -f1))"

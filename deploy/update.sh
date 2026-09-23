#!/usr/bin/env bash
# Pulls the latest code and rebuilds NEWMUX OS. Database migrations run
# automatically when the app starts. Also applies changes to deploy/.env
# (for example a new DOMAIN).
#
#   ./deploy/update.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

git pull --ff-only
docker compose --env-file deploy/.env up -d --build
docker image prune -f >/dev/null
docker compose --env-file deploy/.env ps

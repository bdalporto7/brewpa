#!/usr/bin/env bash
# One-command way to run the roasting app: installs deps, backs up the
# Turso database if one's configured (so every session you actually sit
# down and use the app leaves a fresh local snapshot — no background
# scheduler, no extra permissions, no need to remember), sets up a local
# SQLite DB on first run when Turso isn't configured, then starts the dev
# server every time.
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT/apps/roasting"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if grep -q '^TURSO_DATABASE_URL="[^"]' .env 2>/dev/null; then
  echo "Backing up the database before starting..."
  "$REPO_ROOT/backup-db.sh" || echo "Backup failed — continuing anyway." >&2
elif [ ! -f prisma/dev.db ]; then
  echo "Setting up the local database..."
  npx prisma migrate dev
fi

npm run dev

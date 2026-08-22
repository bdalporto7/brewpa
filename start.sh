#!/usr/bin/env bash
# One-command way to run the roasting app: installs deps and sets up the
# local SQLite DB on first run, then starts the dev server every time.
set -e

cd "$(dirname "$0")/apps/roasting"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

if [ ! -f prisma/dev.db ]; then
  echo "Setting up the local database..."
  npx prisma migrate dev
fi

npm run dev

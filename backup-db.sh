#!/usr/bin/env bash
# Dumps the live Turso database to a local file — a safety net in case the
# hosted database ever gets corrupted, or someone fat-fingers a delete.
# Backups never leave this machine (backups/ is gitignored) and never touch
# the public repo. Run manually anytime; see AGENTS.md for how to schedule
# this automatically via launchd if you want it running on its own.
set -e

DB_NAME="roasting"
BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql"

if ! command -v turso &> /dev/null; then
  echo "turso CLI not found — install it first: brew install tursodatabase/tap/turso" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up Turso database '$DB_NAME'..."
turso db shell "$DB_NAME" ".dump" > "$BACKUP_FILE"
echo "Wrote $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep only the most recent 20 backups so this doesn't grow forever.
OLD_BACKUPS=$(ls -1t "$BACKUP_DIR"/"${DB_NAME}"-*.sql 2>/dev/null | tail -n +21)
if [ -n "$OLD_BACKUPS" ]; then
  echo "$OLD_BACKUPS" | while IFS= read -r f; do rm -- "$f"; done
  echo "Pruned old backups, keeping the most recent 20."
fi

#!/usr/bin/env bash
# Restore a PolyAttend database dump into a target PostgreSQL database.
#
#   ./scripts/restore-db.sh <dump-file> [target-database-url]
#
# With one argument it uses $DATABASE_URL.
#
# The dump files live on the `db-backups` branch:
#   git fetch origin db-backups
#   git checkout db-backups
#   ls .backups/
#
# WARNING: every --clean dump starts with DROP statements, so this ERASES the
# target database before restoring. Point it at a scratch database unless you
# really mean to overwrite production.

set -euo pipefail

DUMP_FILE="${1:-}"
TARGET_URL="${2:-${DATABASE_URL:-}}"

if [ -z "$DUMP_FILE" ]; then
  echo "usage: $0 <dump-file> [target-database-url]" >&2
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "error: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

if [ -z "$TARGET_URL" ]; then
  echo "error: no target database. Pass a URL or set DATABASE_URL." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "error: pg_restore not found. Install postgresql-client." >&2
  exit 1
fi

echo "About to restore:"
echo "  from : $DUMP_FILE"
echo "  into : $(echo "$TARGET_URL" | sed -E 's#://[^@]*@#://***@#')"
read -r -p "This DROPS and recreates every table in the target. Continue? [y/N] " reply
case "$reply" in
  [yY]|[yY][eE][sS]) ;;
  *) echo "aborted"; exit 1 ;;
esac

# --no-owner --no-privileges keeps it portable across providers.
pg_restore \
  --dbname="$TARGET_URL" \
  --clean --if-exists \
  --no-owner --no-privileges \
  --single-transaction \
  "$DUMP_FILE"

echo "restore finished."

#!/bin/bash
set -euo pipefail

ENV=${1:-prod}
DUMP_FILE="./tmp/db_dump/${ENV}.dump"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Not found: $DUMP_FILE"
  echo "Run: bun run db:dump $ENV"
  exit 1
fi

set -a; source .env.local; set +a
# pg_restore emits non-fatal warnings on stderr (existing objects from
# --clean, etc.). Let real failures surface — don't swallow stderr or `|| true`.
pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL" "$DUMP_FILE"
echo "Restored: $DUMP_FILE → local"

#!/bin/bash
set -e

ENV=${1:-prod}
DUMP_FILE="./temp/db_dump/${ENV}.dump"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Not found: $DUMP_FILE"
  echo "Run: bun run db:dump $ENV"
  exit 1
fi

set -a; source .env.local; set +a
pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL" "$DUMP_FILE" 2>/dev/null || true
echo "Restored: $DUMP_FILE → local"

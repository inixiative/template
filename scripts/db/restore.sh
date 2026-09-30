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

# `source` only sets the keys the file defines, so an ambient DATABASE_URL wins
# in a fresh clone, a worktree, or a shell that inherited prod env. --clean DROPs
# every object in the target, so refuse anything that isn't local.
case "${DATABASE_URL:-}" in
  *@localhost*|*@127.0.0.1*|*@host.docker.internal*) ;;
  "")
    echo "DATABASE_URL is not set. restore refuses to run without an explicit local target." >&2
    exit 1
    ;;
  *)
    echo "DATABASE_URL is not local ($DATABASE_URL). restore refuses non-local targets." >&2
    exit 1
    ;;
esac

# pg_restore emits non-fatal warnings on stderr (existing objects from
# --clean, etc.). Let real failures surface — don't swallow stderr or `|| true`.
pg_restore --clean --no-acl --no-owner -d "$DATABASE_URL" "$DUMP_FILE"
echo "Restored: $DUMP_FILE → local"

#!/bin/bash
set -e

ENV=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p ./temp/db_dump
BACKUP_FILE="./temp/db_dump/${ENV}.dump"

"$SCRIPT_DIR/../deployment/with-env.sh" "$ENV" api bash -c "pg_dump -Fc \"\$DATABASE_URL\" -f \"$BACKUP_FILE\""
echo "Saved: $BACKUP_FILE"

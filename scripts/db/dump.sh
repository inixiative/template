#!/bin/bash
set -e

# TODO: Truncate webhookSubscription and webhookEvent tables before dumping
# to prevent duplicate deliveries when the dump is restored into another environment.
# Currently this truncation only happens in clone.sh — move it here so all dump consumers benefit.

ENV=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mkdir -p ./tmp/db_dump
BACKUP_FILE="./tmp/db_dump/${ENV}.dump"

"$SCRIPT_DIR/../deployment/with-env.sh" "$ENV" api bash -c "pg_dump -Fc \"\$DATABASE_URL\" -f \"$BACKUP_FILE\""
echo "Saved: $BACKUP_FILE"

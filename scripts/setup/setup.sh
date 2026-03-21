#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

"$SCRIPT_DIR/check-prereqs.sh"
"$SCRIPT_DIR/sync-env.sh"

bun install
docker-compose up -d
"$ROOT_DIR/scripts/db/wait-postgres.sh"
"$ROOT_DIR/scripts/db/wait-redis.sh"

echo "Generating database client..."
bun run db:generate

echo "Pushing database schema..."
bun run with local api bun run db:push:force

echo "Seeding database..."
bun run with local api bun run db:seed

echo "Setup complete. Run: bun run local"

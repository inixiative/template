#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# Check if project has been launched (config is committed, so grep is reliable)
IS_LAUNCHED=$(grep -c '"launched": true\|launched: true' "$ROOT_DIR/project.config.ts" 2>/dev/null || echo "0")

"$SCRIPT_DIR/check-prereqs.sh"
"$SCRIPT_DIR/sync-env.sh"

bun install
docker-compose up -d
"$ROOT_DIR/scripts/db/wait-postgres.sh"
"$ROOT_DIR/scripts/db/wait-redis.sh"

echo "Generating database client..."
bun run db:generate

if [ "$IS_LAUNCHED" -gt 0 ]; then
  echo ""
  echo "Project is launched — skipping db:push and db:seed."
  echo "Use db:migrate for schema changes."
  echo ""
else
  echo "Pushing database schema..."
  bun run with local api bun run db:push

  echo "Seeding database..."
  bun run with local api bun run db:seed
fi

echo "Setup complete. Run: bun run local"

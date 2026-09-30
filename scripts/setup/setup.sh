#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

# Load .env so child scripts (wait-postgres, wait-redis, docker-compose templating)
# inherit PROJECT_NAME / COMPOSE_PROJECT_NAME. Without this, wait-postgres falls
# back to the literal "template" container name and times out.
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

DATABASE_STRATEGY="$(bun run "$ROOT_DIR/scripts/cicd/databaseStrategy.ts")" || {
  echo "[setup] failed to evaluate cicd.config.ts; aborting" >&2
  exit 1
}

"$SCRIPT_DIR/check-prereqs.sh"
"$SCRIPT_DIR/sync-env.sh"

bun install
docker-compose up -d
"$ROOT_DIR/scripts/db/wait-postgres.sh"
"$ROOT_DIR/scripts/db/wait-redis.sh"

echo "Provisioning MinIO buckets..."
P="${PROJECT_NAME:-template}"
"$ROOT_DIR/scripts/db/minio-provision.sh" "${P}-system" "${P}-user" "${P}-system-test" "${P}-user-test"

echo "Generating database client..."
bun run db:generate

if [ "$DATABASE_STRATEGY" = "migrations" ]; then
  echo ""
  echo "database.strategy is migrations — skipping db:push and db:seed."
  echo "Use db:migrate for schema changes."
  echo ""
else
  echo "Pushing database schema..."
  bun run with local api bun run db:push:force

  echo "Seeding database..."
  bun run with local api bun run db:seed
fi

echo "Setup complete. Run: bun run local"

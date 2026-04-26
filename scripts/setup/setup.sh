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

# Check if project has been launched (config is committed, so grep is reliable)
if [ "$USE_INTERNAL_CONFIG" = "true" ]; then
  CONFIG_FILE="$ROOT_DIR/project.config.template-internal.ts"
else
  CONFIG_FILE="$ROOT_DIR/project.config.ts"
fi
if grep -q 'launched.*true\|"launched": true' "$CONFIG_FILE" 2>/dev/null; then
  IS_LAUNCHED=1
else
  IS_LAUNCHED=0
fi

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
  # NB: do NOT route db:push / db:seed through `bun run with local api ...`.
  # That wrapper maps local → Infisical staging, which holds the cloud
  # DATABASE_URL (or nothing yet, if Railway Postgres Setup hasn't run).
  # setup.sh's intent is to bootstrap the LOCAL DOCKER Postgres that
  # docker-compose just started above on localhost:5432, so source the
  # local .env files directly. Runtime commands (bun run local) still go
  # through Infisical via with-env.sh — that's a separate concern.
  echo "Pushing database schema..."
  (
    set -a
    [ -f "$ROOT_DIR/.env.local" ] && source "$ROOT_DIR/.env.local"
    [ -f "$ROOT_DIR/apps/api/.env.local" ] && source "$ROOT_DIR/apps/api/.env.local"
    set +a
    bun run db:push:force
  )

  echo "Seeding database..."
  (
    set -a
    [ -f "$ROOT_DIR/.env.local" ] && source "$ROOT_DIR/.env.local"
    [ -f "$ROOT_DIR/apps/api/.env.local" ] && source "$ROOT_DIR/apps/api/.env.local"
    set +a
    bun run db:seed
  )
fi

echo "Setup complete. Run: bun run local"

#!/usr/bin/env bash
# destroy.sh — Tear down a worktree, drop its DBs, free its slot.
#
# Usage:
#   bun run worktree:destroy <name>
#
# <name> is the worktree directory name under .worktrees/ (slashes in the
# branch get converted to dashes — see worktree:list).

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

NAME="${1:-}"

if [ -z "$NAME" ]; then
  echo -e "${RED}Usage: $0 <name>${NC}"
  echo "  Run 'bun run worktree:list' to see available worktrees."
  exit 1
fi

if echo "$NAME" | grep -qE '(\.\.|/)'; then
  echo -e "${RED}Error: Name cannot contain '..' or path separators${NC}"
  exit 1
fi

WORKTREE_DIR="$ROOT_DIR/.worktrees/$NAME"
if [ ! -d "$WORKTREE_DIR" ]; then
  echo -e "${RED}Error: Worktree '$NAME' not found at $WORKTREE_DIR${NC}"
  exit 1
fi

PROJECT_NAME=""
if [ -f "$ROOT_DIR/.env" ]; then
  PROJECT_NAME="$(grep -m1 '^PROJECT_NAME=' "$ROOT_DIR/.env" | cut -d= -f2 || true)"
fi
[ -z "$PROJECT_NAME" ] && PROJECT_NAME="$(basename "$ROOT_DIR")"

PG_CONTAINER="${PROJECT_NAME}_postgres"
REDIS_CONTAINER="${PROJECT_NAME}_redis"

# --- 1. Read slot from worktree's .env.local --------------------------------
WT_ENV="$WORKTREE_DIR/.env.local"
SLOT=""
if [ -f "$WT_ENV" ]; then
  SLOT="$(grep -m1 '^WORKTREE_SLOT=' "$WT_ENV" | cut -d= -f2 || true)"
fi

if [ -z "$SLOT" ]; then
  echo -e "${YELLOW}Warning: No WORKTREE_SLOT found — skipping DB / Redis / port cleanup.${NC}"
else
  DB_LOCAL="${PROJECT_NAME}_wt_${SLOT}"
  DB_TEST="${PROJECT_NAME}_test_wt_${SLOT}"

  # --- 2. Drop Postgres databases -------------------------------------------
  if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
    echo -e "${BLUE}Dropping databases: $DB_LOCAL, $DB_TEST...${NC}"
    docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"${DB_LOCAL}\";" >/dev/null
    docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"${DB_TEST}\";"  >/dev/null
    echo -e "${GREEN}Databases dropped${NC}"
  else
    echo -e "${YELLOW}Warning: $PG_CONTAINER not running — skipping DB drop.${NC}"
  fi

  # --- 2b. Remove MinIO buckets ---------------------------------------------
  MINIO_CONTAINER="${PROJECT_NAME}_minio"
  if docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
    STORAGE_BUCKET_SYSTEM="${PROJECT_NAME}-system-wt-${SLOT}"
    STORAGE_BUCKET_USER="${PROJECT_NAME}-user-wt-${SLOT}"
    STORAGE_BUCKET_SYSTEM_TEST="${PROJECT_NAME}-system-test-wt-${SLOT}"
    STORAGE_BUCKET_USER_TEST="${PROJECT_NAME}-user-test-wt-${SLOT}"

    echo -e "${BLUE}Removing MinIO buckets for slot ${SLOT}...${NC}"
    for BUCKET in "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
                   "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"; do
      docker run --rm --network "${PROJECT_NAME}_default" \
        -e MC_HOST_local="http://minioadmin:minioadmin@minio:9000" \
        minio/mc:latest rb --force "local/${BUCKET}" >/dev/null 2>&1 || true
    done
    echo -e "${GREEN}MinIO buckets removed${NC}"
  fi

  # --- 3. Flush Redis logical DB --------------------------------------------
  if docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER"; then
    echo -e "${BLUE}Flushing Redis DB ${SLOT}...${NC}"
    docker exec "$REDIS_CONTAINER" redis-cli -n "$SLOT" FLUSHDB >/dev/null \
      && echo -e "${GREEN}Redis DB ${SLOT} flushed${NC}" \
      || echo -e "${YELLOW}Warning: Could not flush Redis DB${NC}"
  fi

  # --- 4. Kill processes on slot ports --------------------------------------
  PORTS=("3${SLOT}00" "3${SLOT}01" "3${SLOT}02" "8${SLOT}00")
  echo -e "${BLUE}Killing processes on ports: ${PORTS[*]}...${NC}"
  for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$PID" ]; then
      kill -9 "$PID" 2>/dev/null || true
      echo "  Killed PID $PID on port $PORT"
    fi
  done
fi

# --- 5. Remove the git worktree --------------------------------------------
echo -e "${BLUE}Removing git worktree...${NC}"
git -C "$ROOT_DIR" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || {
  echo -e "${YELLOW}git worktree remove failed; cleaning up manually.${NC}"
  rm -rf "$WORKTREE_DIR"
  git -C "$ROOT_DIR" worktree prune
}

echo
echo -e "${GREEN}Worktree '$NAME' destroyed${NC}"
[ -n "$SLOT" ] && echo -e "${GREEN}Slot $SLOT freed${NC}"

#!/bin/bash
# destroy.sh - Tear down a worktree and free its slot
#
# Drops databases, flushes Redis DB, kills port processes, removes worktree.
#
# Usage: scripts/worktree/destroy.sh <name>

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
  echo "  <name>  Worktree directory name under .worktrees/ (branch with slashes -> dashes)"
  echo ""
  echo "Run 'bun run worktree:list' to see available worktrees."
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

# Read project name
PROJECT_NAME="$(grep -m1 '^PROJECT_NAME=' "$ROOT_DIR/.env.local" 2>/dev/null | cut -d= -f2 || echo "template")"
PROJECT_NAME="${PROJECT_NAME:-template}"

# ---------------------------------------------------------------------------
# 1. Read slot from worktree's .env.local
# ---------------------------------------------------------------------------
WT_ENV="$WORKTREE_DIR/.env.local"
SLOT=""
if [ -f "$WT_ENV" ]; then
  SLOT="$(grep -m1 '^WORKTREE_SLOT=' "$WT_ENV" | cut -d= -f2 || true)"
fi

if [ -z "$SLOT" ]; then
  echo -e "${YELLOW}Warning: No WORKTREE_SLOT found in $WT_ENV${NC}"
  echo -e "${YELLOW}Proceeding with worktree removal only (no DB/Redis cleanup)${NC}"
else
  DB_LOCAL="${PROJECT_NAME}_wt_${SLOT}"
  DB_TEST="${PROJECT_NAME}_test_wt_${SLOT}"
  PG_CONTAINER="${PROJECT_NAME}_postgres"
  REDIS_CONTAINER="${PROJECT_NAME}_redis"

  # -------------------------------------------------------------------------
  # 2. Drop PostgreSQL databases
  # -------------------------------------------------------------------------
  echo -e "${BLUE}Dropping databases: $DB_LOCAL, $DB_TEST...${NC}"

  drop_db() {
    local db_name="$1"
    if docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS \"$db_name\";" 2>/dev/null; then
      true
    elif command -v psql >/dev/null 2>&1; then
      psql -U postgres -h localhost -p 5432 -c "DROP DATABASE IF EXISTS \"$db_name\";" 2>/dev/null || true
    fi
  }

  drop_db "$DB_LOCAL"
  drop_db "$DB_TEST"
  echo -e "${GREEN}Databases dropped${NC}"

  # -------------------------------------------------------------------------
  # 3. Flush Redis DB
  # -------------------------------------------------------------------------
  echo -e "${BLUE}Flushing Redis DB ${SLOT}...${NC}"
  docker exec "$REDIS_CONTAINER" redis-cli -n "$SLOT" FLUSHDB 2>/dev/null \
    && echo -e "${GREEN}Redis DB ${SLOT} flushed${NC}" \
    || echo -e "${YELLOW}Warning: Could not flush Redis DB (Docker not running?)${NC}"

  # -------------------------------------------------------------------------
  # 4. Kill processes on worktree ports
  # -------------------------------------------------------------------------
  API_PORT="8${SLOT}00"
  WEB_PORT="3${SLOT}00"
  ADMIN_PORT="3${SLOT}01"
  SUPERADMIN_PORT="3${SLOT}02"
  PORTS=("$API_PORT" "$WEB_PORT" "$ADMIN_PORT" "$SUPERADMIN_PORT")

  echo -e "${BLUE}Killing processes on ports: ${PORTS[*]}...${NC}"
  for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti:"$PORT" 2>/dev/null || true)
    if [ -n "$PID" ]; then
      kill -9 "$PID" 2>/dev/null || true
      echo "  Killed PID $PID on port $PORT"
    fi
  done
fi

# ---------------------------------------------------------------------------
# 5. Remove git worktree
# ---------------------------------------------------------------------------
echo -e "${BLUE}Removing git worktree...${NC}"
git -C "$ROOT_DIR" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || {
  echo -e "${YELLOW}git worktree remove failed, cleaning up manually...${NC}"
  rm -rf "$WORKTREE_DIR"
  git -C "$ROOT_DIR" worktree prune
}

echo ""
echo -e "${GREEN}Worktree '$NAME' destroyed${NC}"
[ -n "$SLOT" ] && echo -e "${GREEN}Slot $SLOT freed${NC}"
echo ""

#!/bin/bash
# create.sh - Create an isolated git worktree with its own ports, DB, and Redis
#
# Each worktree gets a slot (1-9) providing full isolation:
#   Ports:  API=8N00  Web=3N00  Admin=3N01  Superadmin=3N02  (N=slot)
#   DB:     ${PROJECT_NAME}_wt_N (local) / ${PROJECT_NAME}_test_wt_N (test)
#   Redis:  DB number N
#
# Usage: scripts/worktree/create.sh <base-branch> <new-branch>

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

BASE_BRANCH="${1:-}"
NEW_BRANCH="${2:-}"

if [ -z "$BASE_BRANCH" ] || [ -z "$NEW_BRANCH" ]; then
  echo -e "${RED}Usage: $0 <base-branch> <new-branch>${NC}"
  echo "  <base-branch>  Branch to fork from (e.g., main)"
  echo "  <new-branch>   New branch name to create"
  echo ""
  echo "Example: bun run worktree:create main feature/my-feature"
  exit 1
fi

# ---------------------------------------------------------------------------
# Portable sed -i (macOS vs GNU)
# ---------------------------------------------------------------------------
sed_i() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# ---------------------------------------------------------------------------
# Read project name from .env.local or default
# ---------------------------------------------------------------------------
MAIN_ENV="$ROOT_DIR/.env.local"
if [ ! -f "$MAIN_ENV" ]; then
  echo -e "${RED}Error: $MAIN_ENV not found. Run 'bun run setup' first.${NC}"
  exit 1
fi

PROJECT_NAME="$(grep -m1 '^PROJECT_NAME=' "$MAIN_ENV" | cut -d= -f2 || echo "template")"
PROJECT_NAME="${PROJECT_NAME:-template}"

# Derive worktree directory name from branch (slashes → dashes)
WT_NAME="$(echo "$NEW_BRANCH" | tr '/' '-')"
WORKTREE_DIR="$ROOT_DIR/.worktrees/$WT_NAME"

if [ -d "$WORKTREE_DIR" ]; then
  echo -e "${RED}Error: Worktree '$WT_NAME' already exists at $WORKTREE_DIR${NC}"
  exit 1
fi

# Verify base branch exists
if ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$BASE_BRANCH" 2>/dev/null &&
   ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" 2>/dev/null; then
  echo -e "${RED}Error: Base branch '$BASE_BRANCH' not found (local or remote)${NC}"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Scan existing worktrees for allocated slots
# ---------------------------------------------------------------------------
echo -e "${BLUE}Scanning worktrees for allocated slots...${NC}"

USED_SLOTS=" "
MERGED_WARNINGS=""
MERGED_COUNT=0

MERGED_BRANCHES="$(git -C "$ROOT_DIR" branch --merged main 2>/dev/null | sed 's/^[* ]*//' || true)"

while IFS= read -r wt_path; do
  wt_path="$(echo "$wt_path" | xargs)"
  [ -z "$wt_path" ] && continue
  env_file="$wt_path/.env.local"
  if [ -f "$env_file" ]; then
    slot="$(grep -m1 '^WORKTREE_SLOT=' "$env_file" 2>/dev/null | cut -d= -f2 || true)"
    if [ -n "$slot" ]; then
      USED_SLOTS="${USED_SLOTS}${slot} "
      wt_dir_name="$(basename "$wt_path")"
      wt_branch="$(git -C "$ROOT_DIR" worktree list | grep "$wt_path" | sed -n 's/.*\[\(.*\)\].*/\1/p')"
      if [ -n "$wt_branch" ] && echo "$MERGED_BRANCHES" | grep -qx "$wt_branch"; then
        MERGED_WARNINGS="${MERGED_WARNINGS}  Slot ${slot}: ${wt_dir_name} (${wt_branch}) — bun run worktree:destroy ${wt_dir_name}\n"
        MERGED_COUNT=$((MERGED_COUNT + 1))
      fi
    fi
  fi
done < <(git -C "$ROOT_DIR" worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //')

if [ "$MERGED_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}These worktrees have branches already merged into main:${NC}"
  echo -e "${YELLOW}${MERGED_WARNINGS}${NC}"
fi

# ---------------------------------------------------------------------------
# 2. Claim the lowest available slot (1-9)
# ---------------------------------------------------------------------------
SLOT=""
for i in $(seq 1 9); do
  if ! echo "$USED_SLOTS" | grep -q " ${i} "; then
    SLOT="$i"
    break
  fi
done

if [ -z "$SLOT" ]; then
  echo -e "${RED}Error: All 9 worktree slots are in use.${NC}"
  if [ "$MERGED_COUNT" -gt 0 ]; then
    echo -e "${RED}Clean up merged worktrees listed above to free slots.${NC}"
  else
    echo -e "${RED}Run 'bun run worktree:list' to see them.${NC}"
  fi
  exit 1
fi

echo -e "${GREEN}Claimed slot $SLOT${NC}"

# Compute slot-specific values
API_PORT="8${SLOT}00"
WEB_PORT="3${SLOT}00"
ADMIN_PORT="3${SLOT}01"
SUPERADMIN_PORT="3${SLOT}02"
DB_LOCAL="${PROJECT_NAME}_wt_${SLOT}"
DB_TEST="${PROJECT_NAME}_test_wt_${SLOT}"
REDIS_DB="$SLOT"

# ---------------------------------------------------------------------------
# 3. Create git worktree
# ---------------------------------------------------------------------------
echo -e "${BLUE}Creating git worktree on branch '$NEW_BRANCH' from '$BASE_BRANCH'...${NC}"

if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$NEW_BRANCH" 2>/dev/null; then
  git -C "$ROOT_DIR" worktree add "$WORKTREE_DIR" "$NEW_BRANCH"
else
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "$BASE_BRANCH"
fi

# ---------------------------------------------------------------------------
# 4. Generate root .env.local
# ---------------------------------------------------------------------------
echo -e "${BLUE}Generating .env.local...${NC}"

cp "$MAIN_ENV" "$WORKTREE_DIR/.env.local"
WT_ENV="$WORKTREE_DIR/.env.local"

# Add slot identifier at top
sed_i "1s/^/WORKTREE_SLOT=$SLOT\n/" "$WT_ENV"

# Override URLs
sed_i "s|^API_URL=.*|API_URL=http://localhost:${API_PORT}|" "$WT_ENV"
sed_i "s|^WEB_URL=.*|WEB_URL=http://localhost:${WEB_PORT}|" "$WT_ENV"
sed_i "s|^ADMIN_URL=.*|ADMIN_URL=http://localhost:${ADMIN_PORT}|" "$WT_ENV"
sed_i "s|^SUPERADMIN_URL=.*|SUPERADMIN_URL=http://localhost:${SUPERADMIN_PORT}|" "$WT_ENV"
sed_i "s|^BETTER_AUTH_BASE_URL=.*|BETTER_AUTH_BASE_URL=http://localhost:${API_PORT}|" "$WT_ENV"

# ---------------------------------------------------------------------------
# 5. Generate app-level .env.local files
# ---------------------------------------------------------------------------
echo -e "${BLUE}Generating app .env.local files...${NC}"

# API
API_ENV_SRC="$ROOT_DIR/apps/api/.env.local"
if [ -f "$API_ENV_SRC" ]; then
  cp "$API_ENV_SRC" "$WORKTREE_DIR/apps/api/.env.local"
  API_ENV="$WORKTREE_DIR/apps/api/.env.local"
  sed_i "s|^PORT=.*|PORT=${API_PORT}|" "$API_ENV"
  sed_i "s|^API_URL=.*|API_URL=http://localhost:${API_PORT}|" "$API_ENV"
  sed_i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${DB_LOCAL}|" "$API_ENV"
  sed_i "s|^REDIS_URL=.*|REDIS_URL=redis://localhost:6379/${REDIS_DB}|" "$API_ENV"
fi

# Web, Admin, Superadmin — copy if they exist (port is set via Vite config reading env)
for app_info in "web:${WEB_PORT}" "admin:${ADMIN_PORT}" "superadmin:${SUPERADMIN_PORT}"; do
  app="${app_info%%:*}"
  port="${app_info##*:}"
  app_env_src="$ROOT_DIR/apps/$app/.env.local"
  if [ -f "$app_env_src" ]; then
    cp "$app_env_src" "$WORKTREE_DIR/apps/$app/.env.local"
    app_env="$WORKTREE_DIR/apps/$app/.env.local"
    # Override API URL reference if present
    sed_i "s|^API_URL=.*|API_URL=http://localhost:${API_PORT}|" "$app_env"
    sed_i "s|^NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://localhost:${API_PORT}|" "$app_env"
    sed_i "s|^VITE_API_URL=.*|VITE_API_URL=http://localhost:${API_PORT}|" "$app_env"
  fi
done

# ---------------------------------------------------------------------------
# 6. Generate .env.test
# ---------------------------------------------------------------------------
echo -e "${BLUE}Generating .env.test...${NC}"

MAIN_TEST_ENV="$ROOT_DIR/.env.test"
if [ -f "$MAIN_TEST_ENV" ]; then
  cp "$MAIN_TEST_ENV" "$WORKTREE_DIR/.env.test"
  WT_TEST_ENV="$WORKTREE_DIR/.env.test"
  sed_i "1s/^/WORKTREE_SLOT=$SLOT\n/" "$WT_TEST_ENV"
  sed_i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${DB_TEST}|" "$WT_TEST_ENV"
else
  echo -e "${YELLOW}Warning: $MAIN_TEST_ENV not found, skipping .env.test generation${NC}"
fi

# ---------------------------------------------------------------------------
# 7. Create PostgreSQL databases
# ---------------------------------------------------------------------------
echo -e "${BLUE}Creating PostgreSQL databases...${NC}"

PG_CONTAINER="${PROJECT_NAME}_postgres"

create_db() {
  local db_name="$1"
  if docker exec "$PG_CONTAINER" psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='$db_name'" 2>/dev/null | grep -q 1; then
    echo "  Database $db_name already exists"
  elif docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE \"$db_name\";" 2>/dev/null; then
    echo "  Created database $db_name"
  elif command -v psql >/dev/null 2>&1; then
    psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE \"$db_name\";" 2>/dev/null && echo "  Created database $db_name" \
      || echo -e "  ${YELLOW}Warning: Could not create $db_name${NC}"
  else
    echo -e "  ${YELLOW}Warning: Could not create $db_name (no Docker or psql)${NC}"
  fi
}

create_db "$DB_LOCAL"
create_db "$DB_TEST"

# ---------------------------------------------------------------------------
# 8. Run Prisma migrate on worktree databases
# ---------------------------------------------------------------------------
echo -e "${BLUE}Pushing schema to databases...${NC}"

(cd "$WORKTREE_DIR" && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_LOCAL}" \
  bun run --cwd packages/db db:push 2>&1) || {
  echo -e "${YELLOW}Warning: Local DB schema push failed. Run manually: cd .worktrees/$WT_NAME && bun run db:push${NC}"
}

(cd "$WORKTREE_DIR" && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_TEST}" \
  bun run --cwd packages/db db:push:force 2>&1) || {
  echo -e "${YELLOW}Warning: Test DB schema push failed. Run manually in the worktree.${NC}"
}

# ---------------------------------------------------------------------------
# 9. Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN} Worktree '$WT_NAME' ready (slot $SLOT)${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "  Path:         $WORKTREE_DIR"
echo -e "  Branch:       $NEW_BRANCH (from $BASE_BRANCH)"
echo -e "  API:          http://localhost:${API_PORT}"
echo -e "  Web:          http://localhost:${WEB_PORT}"
echo -e "  Admin:        http://localhost:${ADMIN_PORT}"
echo -e "  Superadmin:   http://localhost:${SUPERADMIN_PORT}"
echo -e "  PostgreSQL:   $DB_LOCAL (local) / $DB_TEST (test)"
echo -e "  Redis DB:     $REDIS_DB"
echo ""
echo -e "  ${BLUE}cd .worktrees/$WT_NAME && bun run local${NC}"
echo ""

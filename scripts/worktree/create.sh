#!/usr/bin/env bash
# create.sh — Create an isolated git worktree with its own ports + per-slot
# Postgres DBs (local + test) + Redis DB number.
#
# Usage:
#   bun run worktree:create <base-branch> <new-branch>
#
# A "slot" (1-9) is allocated to each worktree. The slot drives:
#   - Ports:   WEB  3${SLOT}00   ADMIN 3${SLOT}01   SUPERADMIN 3${SLOT}02
#              API  8${SLOT}00
#   - DBs:     ${PROJECT_NAME}_wt_${SLOT}            (local)
#              ${PROJECT_NAME}_test_wt_${SLOT}       (test)
#   - Redis:   logical DB number ${SLOT}
#
# Slot 0 is reserved for the main checkout.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Portable in-place sed (BSD vs GNU)
sedi() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

BASE_BRANCH="${1:-}"
NEW_BRANCH="${2:-}"

if [ -z "$BASE_BRANCH" ] || [ -z "$NEW_BRANCH" ]; then
  echo -e "${RED}Usage: $0 <base-branch> <new-branch>${NC}"
  echo "  Example: bun run worktree:create main feature/my-feature"
  exit 1
fi

# Resolve PROJECT_NAME (drives container + DB naming) — falls back to repo dir.
PROJECT_NAME=""
if [ -f "$ROOT_DIR/.env" ]; then
  PROJECT_NAME="$(grep -m1 '^PROJECT_NAME=' "$ROOT_DIR/.env" | cut -d= -f2 || true)"
fi
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="$(basename "$ROOT_DIR")"
fi

PG_CONTAINER="${PROJECT_NAME}_postgres"
REDIS_CONTAINER="${PROJECT_NAME}_redis"

# Derive worktree directory name (slashes → dashes)
WT_NAME="$(echo "$NEW_BRANCH" | tr '/' '-')"
WORKTREE_DIR="$ROOT_DIR/.worktrees/$WT_NAME"

if [ -d "$WORKTREE_DIR" ]; then
  echo -e "${RED}Error: Worktree '$WT_NAME' already exists at $WORKTREE_DIR${NC}"
  exit 1
fi

# Verify base branch exists (local or remote)
if ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$BASE_BRANCH" 2>/dev/null && \
   ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" 2>/dev/null; then
  echo -e "${RED}Error: Base branch '$BASE_BRANCH' not found (local or remote)${NC}"
  exit 1
fi

# ---------------------------------------------------------------------------
# 1. Scan existing worktrees for allocated slots + warn about merged branches
# ---------------------------------------------------------------------------
echo -e "${BLUE}Scanning existing worktrees...${NC}"

USED_SLOTS=" "
MERGED_WARNINGS=""
MERGED_COUNT=0

MAIN_BRANCH="$(git -C "$ROOT_DIR" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || echo main)"
MERGED_BRANCHES="$(git -C "$ROOT_DIR" branch --merged "$MAIN_BRANCH" 2>/dev/null | sed 's/^[* ]*//' || true)"

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
  echo -e "${YELLOW}These worktrees are already merged into ${MAIN_BRANCH}:${NC}"
  echo -e "${YELLOW}${MERGED_WARNINGS}${NC}"
fi

# ---------------------------------------------------------------------------
# 2. Claim the lowest available slot (1-9; slot 0 reserved for main)
# ---------------------------------------------------------------------------
SLOT=""
for i in $(seq 1 9); do
  if ! echo "$USED_SLOTS" | grep -q " ${i} "; then SLOT="$i"; break; fi
done

if [ -z "$SLOT" ]; then
  echo -e "${RED}Error: All 9 worktree slots are in use.${NC}"
  [ "$MERGED_COUNT" -gt 0 ] && echo -e "${RED}Clean up merged worktrees listed above.${NC}"
  exit 1
fi

echo -e "${GREEN}Claimed slot $SLOT${NC}"

WEB_PORT="3${SLOT}00"
ADMIN_PORT="3${SLOT}01"
SUPERADMIN_PORT="3${SLOT}02"
API_PORT="8${SLOT}00"
DB_LOCAL="${PROJECT_NAME}_wt_${SLOT}"
DB_TEST="${PROJECT_NAME}_test_wt_${SLOT}"
REDIS_DB="$SLOT"

# ---------------------------------------------------------------------------
# 3. Create git worktree
# ---------------------------------------------------------------------------
echo -e "${BLUE}Creating git worktree on '$NEW_BRANCH' from '$BASE_BRANCH'...${NC}"
mkdir -p "$ROOT_DIR/.worktrees"

if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$NEW_BRANCH" 2>/dev/null; then
  git -C "$ROOT_DIR" worktree add "$WORKTREE_DIR" "$NEW_BRANCH"
else
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "$BASE_BRANCH"
fi

# ---------------------------------------------------------------------------
# 4. Generate worktree .env.local from main's .env.local with slot rewrites
# ---------------------------------------------------------------------------
MAIN_ENV="$ROOT_DIR/.env.local"
if [ ! -f "$MAIN_ENV" ]; then
  echo -e "${RED}Error: $MAIN_ENV not found. Run 'bun run setup' (or sync-env) first.${NC}"
  git -C "$ROOT_DIR" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  exit 1
fi

cp "$MAIN_ENV" "$WORKTREE_DIR/.env.local"
WT_ENV="$WORKTREE_DIR/.env.local"
sedi "1s/^/WORKTREE_SLOT=${SLOT}\n/" "$WT_ENV"

# Ports + URLs
sedi "s|^PORT=.*|PORT=${API_PORT}|"                                "$WT_ENV"
sedi "s|^API_URL=.*|API_URL=http://localhost:${API_PORT}|"          "$WT_ENV"
sedi "s|^WEB_URL=.*|WEB_URL=http://localhost:${WEB_PORT}|"          "$WT_ENV"
sedi "s|^ADMIN_URL=.*|ADMIN_URL=http://localhost:${ADMIN_PORT}|"    "$WT_ENV"
sedi "s|^SUPERADMIN_URL=.*|SUPERADMIN_URL=http://localhost:${SUPERADMIN_PORT}|" "$WT_ENV"

# Database (assumes localhost:5432 postgres:postgres — same as main)
sedi "s|/[A-Za-z0-9_]\+\(?\\|$\\)|/${DB_LOCAL}\\1|" "$WT_ENV" || true
# Safer explicit replacement on the DATABASE_URL line:
DB_HOST_USER="$(grep -m1 '^DATABASE_URL=' "$MAIN_ENV" | sed -E 's|^DATABASE_URL=([^/]+://[^@]+@[^/]+)/.*|\1|')"
sedi "s|^DATABASE_URL=.*|DATABASE_URL=${DB_HOST_USER}/${DB_LOCAL}|" "$WT_ENV"

# Redis — append /N to logical DB if a REDIS_URL is present
if grep -q '^REDIS_URL=' "$WT_ENV"; then
  REDIS_BASE="$(grep -m1 '^REDIS_URL=' "$WT_ENV" | sed -E 's|^REDIS_URL=(redis://[^/]+)(/[0-9]+)?|\1|')"
  sedi "s|^REDIS_URL=.*|REDIS_URL=${REDIS_BASE}/${REDIS_DB}|" "$WT_ENV"
fi

# ---------------------------------------------------------------------------
# 5. Generate worktree .env.test
# ---------------------------------------------------------------------------
MAIN_TEST_ENV="$ROOT_DIR/.env.test"
if [ -f "$MAIN_TEST_ENV" ]; then
  cp "$MAIN_TEST_ENV" "$WORKTREE_DIR/.env.test"
  WT_TEST_ENV="$WORKTREE_DIR/.env.test"
  sedi "1s/^/WORKTREE_SLOT=${SLOT}\n/" "$WT_TEST_ENV"

  TEST_HOST_USER="$(grep -m1 '^DATABASE_URL=' "$MAIN_TEST_ENV" | sed -E 's|^DATABASE_URL=([^/]+://[^@]+@[^/]+)/.*|\1|')"
  sedi "s|^DATABASE_URL=.*|DATABASE_URL=${TEST_HOST_USER}/${DB_TEST}|" "$WT_TEST_ENV"
else
  echo -e "${YELLOW}Warning: $MAIN_TEST_ENV not found, skipping .env.test generation${NC}"
fi

# ---------------------------------------------------------------------------
# 6. Create Postgres databases
# ---------------------------------------------------------------------------
echo -e "${BLUE}Creating Postgres databases on $PG_CONTAINER...${NC}"
if docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  for DB in "$DB_LOCAL" "$DB_TEST"; do
    docker exec "$PG_CONTAINER" psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB}'" \
      | grep -q 1 \
      || docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE \"${DB}\""
  done
  echo -e "${GREEN}Created: $DB_LOCAL, $DB_TEST${NC}"
else
  echo -e "${YELLOW}Warning: $PG_CONTAINER not running — skipping DB creation. Start with 'bun run start:db' then re-run this script's DB step manually.${NC}"
fi

# ---------------------------------------------------------------------------
# 7. Push schema to both DBs
# ---------------------------------------------------------------------------
echo -e "${BLUE}Pushing Prisma schema to local + test DBs...${NC}"
(cd "$WORKTREE_DIR" && bun run db:push:dev 2>&1) || \
  echo -e "${YELLOW}Warning: schema push failed; run 'bun run db:push:dev' inside the worktree once issues are fixed.${NC}"

# ---------------------------------------------------------------------------
# 8. Summary
# ---------------------------------------------------------------------------
cat <<EOF

${GREEN}======================================${NC}
${GREEN} Worktree '$WT_NAME' ready (slot $SLOT)${NC}
${GREEN}======================================${NC}

  Path:        $WORKTREE_DIR
  Branch:      $NEW_BRANCH (from $BASE_BRANCH)
  Web:         http://localhost:${WEB_PORT}
  Admin:       http://localhost:${ADMIN_PORT}
  Superadmin:  http://localhost:${SUPERADMIN_PORT}
  API:         http://localhost:${API_PORT}
  DB (local):  ${DB_LOCAL}
  DB (test):   ${DB_TEST}
  Redis DB:    ${REDIS_DB}

  ${BLUE}cd .worktrees/$WT_NAME && bun run local${NC}
EOF

#!/usr/bin/env bash
# create.sh — Create an isolated git worktree with its own ports + per-slot
# Postgres DBs (local + test) + Redis DB number + MinIO buckets.
#
# Usage:
#   bun run worktree:create <base-branch> <new-branch>
#     Fork <new-branch> from <base-branch> and check it out in a new worktree.
#   bun run worktree:create <existing-branch>
#     Attach an existing branch (local or origin/<branch>) to a new worktree.
#     Useful for PR review without disturbing the main checkout.
#
# A "slot" (1-9) is allocated to each worktree. The slot drives:
#   - Ports:   WEB  3${SLOT}00   ADMIN 3${SLOT}01   SUPERADMIN 3${SLOT}02
#              API  8${SLOT}00
#   - DBs:     ${PROJECT_NAME}_wt_${SLOT}            (local)
#              ${PROJECT_NAME}_test_wt_${SLOT}       (test)
#   - Redis:   logical DB number ${SLOT}
#   - Buckets: ${PROJECT_NAME}-{system,user}{,-test}-wt-${SLOT}
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

# Resolve the docker binary — Docker Desktop isn't always symlinked onto PATH
# (a minimal `bun run` PATH in particular misses it), so fall back to the
# app-bundle path. DB/Redis/MinIO steps below route through "$DOCKER"; if it
# can't be resolved the existing `if "$DOCKER" ps` guards skip gracefully.
DOCKER=""
if command -v docker >/dev/null 2>&1; then
  DOCKER="docker"
elif [ -x /Applications/Docker.app/Contents/Resources/bin/docker ]; then
  DOCKER="/Applications/Docker.app/Contents/Resources/bin/docker"
fi

# Portable in-place sed (BSD vs GNU)
sedi() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

ARG1="${1:-}"
ARG2="${2:-}"

if [ -z "$ARG1" ]; then
  echo -e "${RED}Usage:${NC}"
  echo "  $0 <base-branch> <new-branch>   Fork <new-branch> from <base-branch>"
  echo "  $0 <existing-branch>            Attach an existing branch to a new worktree"
  echo
  echo "Examples:"
  echo "  bun run worktree:create main feature/my-feature"
  echo "  bun run worktree:create feature/their-pr"
  exit 1
fi

if [ -n "$ARG2" ]; then
  BASE_BRANCH="$ARG1"
  NEW_BRANCH="$ARG2"
  ATTACH_ONLY=0
else
  BASE_BRANCH=""
  NEW_BRANCH="$ARG1"
  ATTACH_ONLY=1
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

# Verify branch existence for the chosen mode
if [ "$ATTACH_ONLY" -eq 1 ]; then
  if ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$NEW_BRANCH" 2>/dev/null && \
     ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/origin/$NEW_BRANCH" 2>/dev/null; then
    echo -e "${RED}Error: Branch '$NEW_BRANCH' not found (local or remote).${NC}"
    echo -e "${RED}To create a new branch, pass a base too: $0 <base-branch> $NEW_BRANCH${NC}"
    exit 1
  fi
else
  if ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$BASE_BRANCH" 2>/dev/null && \
     ! git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/origin/$BASE_BRANCH" 2>/dev/null; then
    echo -e "${RED}Error: Base branch '$BASE_BRANCH' not found (local or remote)${NC}"
    exit 1
  fi
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
STORAGE_BUCKET_SYSTEM="${PROJECT_NAME}-system-wt-${SLOT}"
STORAGE_BUCKET_USER="${PROJECT_NAME}-user-wt-${SLOT}"
STORAGE_BUCKET_SYSTEM_TEST="${PROJECT_NAME}-system-test-wt-${SLOT}"
STORAGE_BUCKET_USER_TEST="${PROJECT_NAME}-user-test-wt-${SLOT}"

# ---------------------------------------------------------------------------
# 3. Create git worktree
# ---------------------------------------------------------------------------
if [ "$ATTACH_ONLY" -eq 1 ]; then
  echo -e "${BLUE}Attaching existing branch '$NEW_BRANCH' to a new worktree...${NC}"
else
  echo -e "${BLUE}Creating git worktree on '$NEW_BRANCH' from '$BASE_BRANCH'...${NC}"
fi
mkdir -p "$ROOT_DIR/.worktrees"

if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$NEW_BRANCH" 2>/dev/null; then
  git -C "$ROOT_DIR" worktree add "$WORKTREE_DIR" "$NEW_BRANCH"
elif [ "$ATTACH_ONLY" -eq 1 ]; then
  # Origin-only branch — create local tracking branch
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "origin/$NEW_BRANCH"
else
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "$BASE_BRANCH"
fi

# ---------------------------------------------------------------------------
# 4. Generate worktree .env.local from main's .env.local with slot rewrites
# ---------------------------------------------------------------------------

# Rewrite the database-name segment of DATABASE_URL in a file to $2, preserving
# scheme://user:pw@host:port and any ?query. No-op when the file has no
# DATABASE_URL. In this monorepo the URL lives in different files per env (root
# .env.test vs apps/api/.env.local), so we rewrite wherever it appears rather than
# appending it to one fixed file.
rewrite_database_url() {
  local file="$1" db="$2"
  [ -f "$file" ] && grep -q '^DATABASE_URL=' "$file" || return 0
  sedi -E "s|^(DATABASE_URL=[a-z]+://[^@]+@[^/]+/)[^?[:space:]]*|\1${db}|" "$file"
}

# Point a localhost REDIS_URL/REDIS_QUEUE_URL at this slot's logical DB ($2).
# Leaves the 'noop' test sentinel and any non-localhost host untouched.
rewrite_redis_db() {
  local file="$1" n="$2"
  [ -f "$file" ] || return 0
  sedi -E "s#^(REDIS(_QUEUE)?_URL=redis://([^@/]*@)?(localhost|127\.0\.0\.1):[0-9]+)(/[0-9]+)?[[:space:]]*\$#\1/${n}#" "$file"
}

# Copy each apps/<app>/.env.<kind> present in main into the worktree (these files
# are gitignored, so a fresh checkout has none) and slot-localize DATABASE_URL +
# REDIS. Without this the worktree has no apps/api/.env.test — so the API's env
# validation (encryption keys) fails — and apps/api/.env.local keeps main's DB.
localize_app_envs() {
  local kind="$1" db="$2"
  for src in "$ROOT_DIR"/apps/*/.env."$kind"; do
    [ -f "$src" ] || continue
    local dst="$WORKTREE_DIR/${src#"$ROOT_DIR"/}"
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    rewrite_database_url "$dst" "$db"
    rewrite_redis_db "$dst" "$REDIS_DB"
  done
}

MAIN_ENV="$ROOT_DIR/.env.local"
if [ ! -f "$MAIN_ENV" ]; then
  echo -e "${RED}Error: $MAIN_ENV not found. Run 'bun run setup' (or sync-env) first.${NC}"
  git -C "$ROOT_DIR" worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
  exit 1
fi

cp "$MAIN_ENV" "$WORKTREE_DIR/.env.local"
WT_ENV="$WORKTREE_DIR/.env.local"
sedi "1s/^/WORKTREE_SLOT=${SLOT}\n/" "$WT_ENV"

# Set a key in $WT_ENV: replace if present, append if absent. Bare `sedi` silently
# no-ops on missing keys — which once left worktrees pointing FE URLs at the main
# checkout's ports. Use this for every slot-critical key.
ensure_env_var() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$WT_ENV"; then
    sedi "s|^${key}=.*|${key}=${value}|" "$WT_ENV"
  else
    echo "${key}=${value}" >> "$WT_ENV"
  fi
}

# Ports + URLs
ensure_env_var "PORT"           "$API_PORT"
ensure_env_var "API_URL"        "http://localhost:${API_PORT}"
ensure_env_var "WEB_URL"        "http://localhost:${WEB_PORT}"
ensure_env_var "ADMIN_URL"      "http://localhost:${ADMIN_PORT}"
ensure_env_var "SUPERADMIN_URL" "http://localhost:${SUPERADMIN_PORT}"

# Database — rewrite DATABASE_URL in place wherever it lives. The local DB URL is
# in apps/api/.env.local (handled by localize_app_envs below); this covers any
# root-level DATABASE_URL (root-env stacks) and is a no-op when there is none.
rewrite_database_url "$WT_ENV" "$DB_LOCAL"

# Storage buckets — slot-isolated
ensure_env_var "STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_SYSTEM"
ensure_env_var "STORAGE_BUCKET_USER"   "$STORAGE_BUCKET_USER"

# Redis — point any localhost REDIS_URL at this slot's logical DB (root, if present).
rewrite_redis_db "$WT_ENV" "$REDIS_DB"

# App-level env: with-env composes root then apps/<app>/.env.local, and the local
# DATABASE_URL lives in apps/api/.env.local — so the slot DB must be written there,
# and these gitignored files must be created in the worktree.
localize_app_envs local "$DB_LOCAL"

# ---------------------------------------------------------------------------
# 5. Generate worktree .env.test
# ---------------------------------------------------------------------------
MAIN_TEST_ENV="$ROOT_DIR/.env.test"
if [ -f "$MAIN_TEST_ENV" ]; then
  cp "$MAIN_TEST_ENV" "$WORKTREE_DIR/.env.test"
  WT_TEST_ENV="$WORKTREE_DIR/.env.test"
  sedi "1s/^/WORKTREE_SLOT=${SLOT}\n/" "$WT_TEST_ENV"

  # Local helper bound to the test env file (same semantics as the one above)
  ensure_test_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$WT_TEST_ENV"; then
      sedi "s|^${key}=.*|${key}=${value}|" "$WT_TEST_ENV"
    else
      echo "${key}=${value}" >> "$WT_TEST_ENV"
    fi
  }

  rewrite_database_url "$WT_TEST_ENV" "$DB_TEST"
  ensure_test_env_var "STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_SYSTEM_TEST"
  ensure_test_env_var "STORAGE_BUCKET_USER"   "$STORAGE_BUCKET_USER_TEST"
else
  echo -e "${YELLOW}Warning: $MAIN_TEST_ENV not found, skipping root .env.test generation${NC}"
fi

# App-level test env: apps/api/.env.test carries the encryption keys the API's env
# validation requires (and, for some stacks, the test DATABASE_URL). Generate these
# regardless of whether the root .env.test existed.
localize_app_envs test "$DB_TEST"

# ---------------------------------------------------------------------------
# 6. Create Postgres databases
# ---------------------------------------------------------------------------
echo -e "${BLUE}Creating Postgres databases on $PG_CONTAINER...${NC}"
if "$DOCKER" ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  for DB in "$DB_LOCAL" "$DB_TEST"; do
    "$DOCKER" exec "$PG_CONTAINER" psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='${DB}'" \
      | grep -q 1 \
      || "$DOCKER" exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE \"${DB}\""
  done
  echo -e "${GREEN}Created: $DB_LOCAL, $DB_TEST${NC}"
else
  echo -e "${YELLOW}Warning: $PG_CONTAINER not running — skipping DB creation. Start with 'bun run start:db' then re-run this script's DB step manually.${NC}"
fi

# ---------------------------------------------------------------------------
# 6b. Create MinIO buckets for this slot
# ---------------------------------------------------------------------------
echo -e "${BLUE}Provisioning MinIO buckets for slot ${SLOT}...${NC}"
"$ROOT_DIR/scripts/db/minio-provision.sh" \
  "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
  "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"

# ---------------------------------------------------------------------------
# 7. Install dependencies in the worktree
# ---------------------------------------------------------------------------
# A git worktree is a fresh working dir with NO node_modules. Because .worktrees/
# lives inside the main repo, bun could otherwise resolve UP to the main checkout's
# node_modules and silently run main's code (e.g. a generated Prisma client that
# predates a migration on this branch). ALWAYS force a real install into the
# worktree — never rely on links to (or hoisting from) the main checkout.
# --ignore-scripts mirrors 'bun run setup' (prepare/husky already ran in main).
echo -e "${BLUE}Installing dependencies (bun install --force --ignore-scripts)...${NC}"
if ! (cd "$WORKTREE_DIR" && bun install --force --ignore-scripts 2>&1 | tail -5; exit "${PIPESTATUS[0]}"); then
  echo -e "${RED}Error: bun install --force failed in $WORKTREE_DIR. Fix the issue, then run 'bun install --force' there.${NC}"
  exit 1
fi

# ---------------------------------------------------------------------------
# 8. Push schema to both DBs
# ---------------------------------------------------------------------------
echo -e "${BLUE}Pushing Prisma schema to local + test DBs...${NC}"
(cd "$WORKTREE_DIR" && bun run db:push:dev 2>&1) || \
  echo -e "${YELLOW}Warning: schema push failed; run 'bun run db:push:dev' inside the worktree once issues are fixed.${NC}"

# ---------------------------------------------------------------------------
# 9. Smoke-test DB connectivity (confirms the slot's local DB is reachable)
# ---------------------------------------------------------------------------
echo -e "${BLUE}Verifying DB connectivity...${NC}"
if "$DOCKER" ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  DB_PING="$("$DOCKER" exec "$PG_CONTAINER" psql -U postgres -d "$DB_LOCAL" -tAc "SELECT 1;" 2>/dev/null || true)"
  if [ "$DB_PING" = "1" ]; then
    echo -e "${GREEN}DB reachable: $DB_LOCAL${NC}"
  else
    echo -e "${YELLOW}Warning: could not verify DB $DB_LOCAL is reachable.${NC}"
  fi
else
  echo -e "${YELLOW}Warning: $PG_CONTAINER not running — skipping DB connectivity check.${NC}"
fi

# ---------------------------------------------------------------------------
# 10. Summary
# ---------------------------------------------------------------------------
cat <<EOF

${GREEN}======================================${NC}
${GREEN} Worktree '$WT_NAME' ready (slot $SLOT)${NC}
${GREEN}======================================${NC}

  Path:        $WORKTREE_DIR
  Branch:      $NEW_BRANCH $( [ "$ATTACH_ONLY" -eq 1 ] && echo "(attached)" || echo "(from $BASE_BRANCH)" )
  Web:         http://localhost:${WEB_PORT}
  Admin:       http://localhost:${ADMIN_PORT}
  Superadmin:  http://localhost:${SUPERADMIN_PORT}
  API:         http://localhost:${API_PORT}
  DB (local):  ${DB_LOCAL}
  DB (test):   ${DB_TEST}
  Redis DB:    ${REDIS_DB}
  Buckets:     ${STORAGE_BUCKET_SYSTEM}, ${STORAGE_BUCKET_USER}
               ${STORAGE_BUCKET_SYSTEM_TEST}, ${STORAGE_BUCKET_USER_TEST}

  ${BLUE}cd .worktrees/$WT_NAME && bun run local${NC}
EOF

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"
PROJECT_NAME="$(project_name "$ROOT_DIR")"
PG_CONTAINER="${PROJECT_NAME}_postgres"

usage() {
  echo -e "${RED}Usage:${NC}"
  echo "  $0 <base-branch> <new-branch> [--skip-db]   Fork <new-branch> from <base-branch>"
  echo "  $0 <existing-branch> [--skip-db]            Attach an existing branch to a new worktree"
  echo
  echo "  --skip-db   Edit-only worktree: no slot databases, buckets, or schema push; Docker not required"
  echo
  echo "Examples:"
  echo "  bun run worktree:create main feature/my-feature"
  echo "  bun run worktree:create feature/their-pr"
  echo "  bun run worktree:create main docs-only --skip-db"
  exit 1
}

SKIP_DB=0
ARG1=""
ARG2=""
for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=1 ;;
    -*) echo -e "${RED}Unknown flag: $arg${NC}"; usage ;;
    *)
      if [ -z "$ARG1" ]; then ARG1="$arg"
      elif [ -z "$ARG2" ]; then ARG2="$arg"
      else usage
      fi
      ;;
  esac
done
[ -n "$ARG1" ] || usage

if [ -n "$ARG2" ]; then
  BASE_BRANCH="$ARG1"
  NEW_BRANCH="$ARG2"
  ATTACH_ONLY=0
else
  BASE_BRANCH=""
  NEW_BRANCH="$ARG1"
  ATTACH_ONLY=1
fi

WT_NAME="$(echo "$NEW_BRANCH" | tr '/' '-')"
WORKTREE_DIR="$ROOT_DIR/.worktrees/$WT_NAME"

if [ -d "$WORKTREE_DIR" ]; then
  die "Error: Worktree '$WT_NAME' already exists at $WORKTREE_DIR"
fi

branch_exists() {
  git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$1" 2>/dev/null || \
    git -C "$ROOT_DIR" show-ref --verify --quiet "refs/remotes/origin/$1" 2>/dev/null
}

if [ "$ATTACH_ONLY" -eq 1 ]; then
  if ! branch_exists "$NEW_BRANCH"; then
    echo -e "${RED}Error: Branch '$NEW_BRANCH' not found (local or remote).${NC}"
    die "To create a new branch, pass a base too: $0 <base-branch> $NEW_BRANCH"
  fi
else
  branch_exists "$BASE_BRANCH" || die "Error: Base branch '$BASE_BRANCH' not found (local or remote)"
  if branch_exists "$NEW_BRANCH"; then
    echo -e "${RED}Error: Branch '$NEW_BRANCH' already exists, so it cannot be forked from '$BASE_BRANCH'.${NC}"
    die "Attach it as it is with: $0 $NEW_BRANCH — or pick a new branch name."
  fi
fi

MAIN_ENV="$ROOT_DIR/.env.local"
[ -f "$MAIN_ENV" ] || die "Error: $MAIN_ENV not found. Run 'bun run setup' (or 'bun run sync-env') first."

DOCKER=""
DB_AVAILABLE=0
if [ "$SKIP_DB" -eq 1 ]; then
  warn "--skip-db: no slot databases, buckets, or schema push. This worktree is for editing and typecheck only."
else
  DOCKER="$(resolve_docker)" || die "Error: docker not found on PATH, in ~/.docker/bin, or in /Applications/Docker.app.
Start Docker Desktop, or pass --skip-db for an edit-only worktree."
  "$DOCKER" info >/dev/null 2>&1 || die "Error: the Docker daemon is not running ($DOCKER info failed).
Start Docker Desktop, or pass --skip-db for an edit-only worktree."

  case "$(container_state "$PG_CONTAINER")" in
    true) ;;
    false)
      info "$PG_CONTAINER is stopped — starting it..."
      "$DOCKER" start "$PG_CONTAINER" >/dev/null || die "Error: could not start the $PG_CONTAINER container."
      ;;
    *)
      die "Error: no $PG_CONTAINER container. Run 'bun run local:db' once to create the stack, or pass --skip-db."
      ;;
  esac

  PSQL=("$DOCKER" exec "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -qtA)
  for _ in $(seq 1 30); do
    if [ "$("${PSQL[@]}" -c 'SELECT 1;' 2>/dev/null || true)" = "1" ]; then
      DB_AVAILABLE=1
      break
    fi
    sleep 1
  done
  [ "$DB_AVAILABLE" -eq 1 ] || die "Error: $PG_CONTAINER is running but does not answer as postgres."
  ok "Docker: $DOCKER — $PG_CONTAINER reachable"
fi

info "Scanning worktrees for allocated slots..."

MAIN_BRANCH="$(default_branch "$ROOT_DIR")"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
MERGED_BRANCHES="$(git -C "$ROOT_DIR" branch --merged "$MAIN_BRANCH" 2>/dev/null | sed 's/^[*+ ]*//' || true)"

prune_slot_registry

SLOT_OWNER=("" "" "" "" "" "" "" "" "" "")
MERGED_WARNINGS=""
MERGED_COUNT=0

claim() {
  local slot="$1" owner="$2"
  valid_slot "$slot" || return 0
  [ -n "${SLOT_OWNER[$slot]}" ] || SLOT_OWNER[$slot]="$owner"
}

while IFS= read -r entry; do
  [ -n "$entry" ] || continue
  claim "${entry%% *}" "${entry#* }"
done < <(registry_entries)

while IFS= read -r wt_path; do
  [ -n "$wt_path" ] && [ -d "$wt_path" ] || continue
  wt_branch="$(git -C "$wt_path" branch --show-current 2>/dev/null || true)"
  wt_slots="$(worktree_slots "$wt_path" | tr '\n' ' ')"
  if [ "$(echo "$wt_slots" | wc -w | tr -d ' ')" -gt 1 ]; then
    warn "$(basename "$wt_path") references more than one slot (${wt_slots}) — reserving all of them. Fix its env files so they agree."
  fi
  for i in $wt_slots; do
    claim "$i" "$wt_path"
    if [ -n "$wt_branch" ] && grep -qxF -- "$wt_branch" <<< "$MERGED_BRANCHES"; then
      MERGED_WARNINGS="${MERGED_WARNINGS}  Slot ${i}: $(basename "$wt_path") (${wt_branch}) — bun run worktree:destroy $(basename "$wt_path")\n"
      MERGED_COUNT=$((MERGED_COUNT + 1))
    fi
  done
done < <(linked_worktrees)

if [ "$MERGED_COUNT" -gt 0 ]; then
  warn "These worktrees have branches already merged into ${MAIN_BRANCH}:"
  warn "$MERGED_WARNINGS"
fi

SLOT=""
SLOT_LOCK=""
SLOT_REGISTERED=0
CREATED=0
FINISHED=0

on_exit() {
  local rc=$?
  release_slot_lock
  if [ "$rc" -ne 0 ] && [ "$FINISHED" -eq 0 ]; then
    if [ "$CREATED" -eq 1 ]; then
      warn "The worktree '$WT_NAME' was created before this failure (exit $rc). Remove it and free slot $SLOT with:"
      warn "  bun run worktree:destroy $WT_NAME --force"
    elif [ "$SLOT_REGISTERED" -eq 1 ]; then
      unregister_slot "$SLOT" "$WORKTREE_DIR"
      [ -d "$WORKTREE_DIR" ] && rm -rf "$WORKTREE_DIR" && git -C "$ROOT_DIR" worktree prune
      warn "Interrupted before the worktree existed (exit $rc) — slot $SLOT released."
    fi
  fi
}
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

for i in $(seq 1 9); do
  lock="$(lock_root)/slot-$i"
  if [ -d "$lock" ]; then
    lock_owner_pid="$(lock_pid "$lock")"
    if reclaim_stale_lock "$i"; then
      warn "  slot $i: stale lock (pid ${lock_owner_pid:-none} dead) — reclaimed"
      owner="$(registry_owner "$i")"
      if [ -n "$owner" ] && [ ! -d "$owner" ]; then
        warn "  slot $i: registry entry $owner has no directory (create killed mid-way) — removed"
        rm -f "$(registry_file "$i")"
        SLOT_OWNER[$i]=""
      fi
    elif [ -d "$lock" ]; then
      echo "  slot $i: being provisioned by ${SLOT_OWNER[$i]:-another create} (pid ${lock_owner_pid:-unknown}) — skipping"
      continue
    fi
  fi
  if [ -n "${SLOT_OWNER[$i]}" ]; then
    if [ -d "${SLOT_OWNER[$i]}" ]; then
      echo "  slot $i: in use by $(basename "${SLOT_OWNER[$i]}") — free it with: bun run worktree:destroy $(basename "${SLOT_OWNER[$i]}")"
    else
      echo "  slot $i: reserved by a fresh registry entry for ${SLOT_OWNER[$i]} — freed automatically after ${REGISTRY_STALE_SECONDS}s if that create never finishes"
    fi
    continue
  fi
  if claim_slot_lock "$i"; then
    SLOT="$i"
    break
  fi
  echo "  slot $i: locked by another create that started just now — skipping"
done

if [ -z "$SLOT" ]; then
  echo -e "${RED}Error: All 9 worktree slots are in use (or locked by a create in progress).${NC}"
  [ "$MERGED_COUNT" -gt 0 ] && echo -e "${RED}Clean up merged worktrees listed above to free slots.${NC}"
  die "Run 'bun run worktree:list' to see them."
fi

ok "Claimed slot $SLOT"
slot_resources "$SLOT"
register_slot "$SLOT" "$WORKTREE_DIR"
SLOT_REGISTERED=1

if [ "$ATTACH_ONLY" -eq 1 ]; then
  info "Attaching existing branch '$NEW_BRANCH' to a new worktree..."
else
  info "Creating git worktree on '$NEW_BRANCH' from '$BASE_BRANCH'..."
fi

if git -C "$ROOT_DIR" show-ref --verify --quiet "refs/heads/$NEW_BRANCH" 2>/dev/null; then
  git -C "$ROOT_DIR" worktree add "$WORKTREE_DIR" "$NEW_BRANCH"
elif [ "$ATTACH_ONLY" -eq 1 ]; then
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "origin/$NEW_BRANCH"
else
  git -C "$ROOT_DIR" worktree add -b "$NEW_BRANCH" "$WORKTREE_DIR" "$BASE_BRANCH"
fi
CREATED=1

info "Generating env files (root values, the branch's keys, slot $SLOT ports/DBs/buckets)..."

WT_ENV="$WORKTREE_DIR/.env.local"
WT_TEST_ENV="$WORKTREE_DIR/.env.test"

copy_env_without_marker "$MAIN_ENV" "$WT_ENV"
[ -f "$ROOT_DIR/.env.test" ] && copy_env_without_marker "$ROOT_DIR/.env.test" "$WT_TEST_ENV"
for src in "$ROOT_DIR"/apps/*/.env.local "$ROOT_DIR"/apps/*/.env.test; do
  [ -f "$src" ] || continue
  copy_env_without_marker "$src" "$WORKTREE_DIR/${src#"$ROOT_DIR"/}"
done

SYNC_ENV="$WORKTREE_DIR/scripts/setup/sync-env.sh"
[ -f "$SYNC_ENV" ] || SYNC_ENV="$ROOT_DIR/scripts/setup/sync-env.sh"
if ! SYNC_OUT="$(cd "$WORKTREE_DIR" && bash "$SYNC_ENV" 2>&1)"; then
  echo "$SYNC_OUT"
  die "Error: syncing env files against the branch's .env.*.example files failed."
fi
[ -n "$SYNC_OUT" ] && echo "$SYNC_OUT" | sed 's/^/  /'

prepend_slot_marker "$WT_ENV" "$SLOT"
prepend_slot_marker "$WT_TEST_ENV" "$SLOT"

ensure_env_var "$WT_ENV" PORT "$API_PORT"
ensure_env_var "$WT_ENV" API_URL "http://localhost:${API_PORT}"
ensure_env_var "$WT_ENV" WEB_URL "http://localhost:${WEB_PORT}"
ensure_env_var "$WT_ENV" ADMIN_URL "http://localhost:${ADMIN_PORT}"
ensure_env_var "$WT_ENV" SUPERADMIN_URL "http://localhost:${SUPERADMIN_PORT}"
replace_env_var_if_present "$WT_ENV" BETTER_AUTH_BASE_URL "http://localhost:${API_PORT}"
ensure_env_var "$WT_ENV" STORAGE_BUCKET_SYSTEM "$STORAGE_BUCKET_SYSTEM"
ensure_env_var "$WT_ENV" STORAGE_BUCKET_USER "$STORAGE_BUCKET_USER"
rewrite_database_url "$WT_ENV" "$DB_LOCAL"
rewrite_redis_db "$WT_ENV" "$REDIS_DB"

if [ -f "$WT_TEST_ENV" ]; then
  ensure_env_var "$WT_TEST_ENV" STORAGE_BUCKET_SYSTEM "$STORAGE_BUCKET_SYSTEM_TEST"
  ensure_env_var "$WT_TEST_ENV" STORAGE_BUCKET_USER "$STORAGE_BUCKET_USER_TEST"
  replace_env_var_if_present "$WT_TEST_ENV" API_URL "http://localhost:${API_PORT}"
  replace_env_var_if_present "$WT_TEST_ENV" WEB_URL "http://localhost:${WEB_PORT}"
  replace_env_var_if_present "$WT_TEST_ENV" ADMIN_URL "http://localhost:${ADMIN_PORT}"
  replace_env_var_if_present "$WT_TEST_ENV" SUPERADMIN_URL "http://localhost:${SUPERADMIN_PORT}"
  rewrite_database_url "$WT_TEST_ENV" "$DB_TEST"
  rewrite_redis_db "$WT_TEST_ENV" "$REDIS_DB"
else
  warn "Warning: neither root .env.test nor a .env.test.example on this branch — .env.test not generated."
fi

for f in "$WORKTREE_DIR"/apps/*/.env.local; do
  [ -f "$f" ] || continue
  replace_env_var_if_present "$f" PORT "$API_PORT"
  replace_env_var_if_present "$f" API_URL "http://localhost:${API_PORT}"
  replace_env_var_if_present "$f" WEB_URL "http://localhost:${WEB_PORT}"
  replace_env_var_if_present "$f" ADMIN_URL "http://localhost:${ADMIN_PORT}"
  replace_env_var_if_present "$f" SUPERADMIN_URL "http://localhost:${SUPERADMIN_PORT}"
  rewrite_database_url "$f" "$DB_LOCAL"
  rewrite_redis_db "$f" "$REDIS_DB"
done
for f in "$WORKTREE_DIR"/apps/*/.env.test; do
  [ -f "$f" ] || continue
  replace_env_var_if_present "$f" API_URL "http://localhost:${API_PORT}"
  rewrite_database_url "$f" "$DB_TEST"
  rewrite_redis_db "$f" "$REDIS_DB"
done

GAPS=""

while IFS= read -r f; do
  [ -n "$f" ] || continue
  env_file_sources "$f" || GAPS="${GAPS}  - ${f#"$WORKTREE_DIR"/} does not source cleanly (unterminated quote or bad line) — fix it by hand, then compare with its .example\n"
done < <(worktree_env_files "$WORKTREE_DIR")

if [ "$DB_AVAILABLE" -eq 1 ]; then
  require_env_key DATABASE_URL "$WORKTREE_DIR/apps/api/.env.local" "$WT_ENV"
  require_env_key DATABASE_URL "$WT_TEST_ENV" "$WORKTREE_DIR/apps/api/.env.test"

  info "Creating Postgres databases on $PG_CONTAINER..."
  for DB in "$DB_LOCAL" "$DB_TEST"; do
    DB_EXISTS="$("${PSQL[@]}" -c "SELECT 1 FROM pg_database WHERE datname='${DB}';" 2>&1)" \
      || die "Error: could not list databases on $PG_CONTAINER (psql failed: ${DB_EXISTS}) — not assuming $DB is absent."
    if [ "$DB_EXISTS" = "1" ]; then
      if CLAIMANT="$(slot_claimant "$SLOT" "$WORKTREE_DIR")"; then
        die "Error: database $DB already exists and the worktree at $CLAIMANT references slot $SLOT — refusing to drop it.
Run 'bun run worktree:destroy $(basename "$CLAIMANT")' if that worktree is finished, then re-run this command."
      fi
      warn "Slot $SLOT still has database $DB from a worktree that was not removed with worktree:destroy — dropping it."
      "${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"${DB}\" WITH (FORCE);" || die "Error: dropping orphaned $DB failed."
    fi
    "${PSQL[@]}" -c "CREATE DATABASE \"${DB}\";" || die "Error: creating $DB failed."
  done
  ok "Created databases: $DB_LOCAL, $DB_TEST"

  info "Provisioning MinIO buckets for slot ${SLOT}..."
  MINIO_PROVISION="$WORKTREE_DIR/scripts/db/minio-provision.sh"
  [ -f "$MINIO_PROVISION" ] || MINIO_PROVISION="$ROOT_DIR/scripts/db/minio-provision.sh"
  storage_env_from "$MAIN_ENV"
  PATH="$(dirname "$DOCKER"):$PATH" bash "$MINIO_PROVISION" \
    "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
    "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"
fi

info "Installing dependencies (bun install --force --ignore-scripts)..."
(cd "$WORKTREE_DIR" && bun install --force --ignore-scripts 2>&1 | tail -5; exit "${PIPESTATUS[0]}") \
  || die "Error: bun install failed in $WORKTREE_DIR. Fix the issue, then run 'bun install --force' there."

WT_REAL="$(cd "$WORKTREE_DIR" && pwd -P)"
DB_PKG_REAL="$(cd "$WORKTREE_DIR/apps/api/node_modules/@template/db" 2>/dev/null && pwd -P || true)"
case "$DB_PKG_REAL" in
  "$WT_REAL"/*) ok "Workspace packages resolve inside the worktree ($DB_PKG_REAL)" ;;
  *) die "Error: apps/api/node_modules/@template/db resolves to '${DB_PKG_REAL:-<missing>}', not inside $WORKTREE_DIR.
Run 'bun install --force' in $WORKTREE_DIR and check 'readlink apps/api/node_modules/@template/db'." ;;
esac

run_step "Generating route trees" bun run generate:routes || true
run_step "Generating Prisma client, prismaMap, and zod schemas" bun run db:generate || true
run_step "Generating OpenAPI spec, SDK, and MSW handlers" bun run generate:sdk || true

require_artifact apps/web/app/routeTree.gen.ts "bun run generate:routes"
require_artifact apps/admin/app/routeTree.gen.ts "bun run generate:routes"
require_artifact apps/superadmin/app/routeTree.gen.ts "bun run generate:routes"
require_artifact packages/db/src/generated/client "bun run db:generate"
require_artifact packages/db/src/generated/prismaMap.gen.ts "bun run db:generate"
require_artifact packages/db/src/generated/zod "bun run db:generate"
require_artifact packages/sdk/src/generated/sdk.gen.ts "bun run generate:sdk"
require_artifact packages/ui/src/test/mocks/handlers.gen.ts "bun run generate:sdk"

if [ "$DB_AVAILABLE" -eq 1 ]; then
  run_step "Pushing Prisma schema to $DB_LOCAL and $DB_TEST" bun run db:push:dev \
    || GAPS="${GAPS}  - schema not pushed to $DB_LOCAL / $DB_TEST — rerun in the worktree: bun run db:push:dev\n"

  if [ "$("${PSQL[@]}" -d "$DB_LOCAL" -c "SELECT 1;" 2>/dev/null || true)" = "1" ]; then
    ok "DB reachable: $DB_LOCAL"
  else
    GAPS="${GAPS}  - $DB_LOCAL does not answer — check DATABASE_URL in $WORKTREE_DIR/apps/api/.env.local\n"
  fi
fi

FINISHED=1
echo
if [ -z "$GAPS" ]; then
  ok "======================================"
  ok " Worktree '$WT_NAME' ready (slot $SLOT)"
  ok "======================================"
else
  warn "======================================"
  warn " Worktree '$WT_NAME' created (slot $SLOT) WITH GAPS"
  warn "======================================"
  warn "Provisioning did not finish. Fix these before running services or tests:"
  warn "$GAPS"
fi
echo
echo "  Path:        $WORKTREE_DIR"
if [ "$ATTACH_ONLY" -eq 1 ]; then
  echo "  Branch:      $NEW_BRANCH (attached)"
else
  echo "  Branch:      $NEW_BRANCH (from $BASE_BRANCH)"
fi
echo "  Web:         http://localhost:${WEB_PORT}"
echo "  Admin:       http://localhost:${ADMIN_PORT}"
echo "  Superadmin:  http://localhost:${SUPERADMIN_PORT}"
echo "  API:         http://localhost:${API_PORT}"
if [ "$SKIP_DB" -eq 1 ]; then
  echo "  DB:          none (--skip-db)"
  echo "  Buckets:     none (--skip-db)"
else
  echo "  DB (local):  ${DB_LOCAL}"
  echo "  DB (test):   ${DB_TEST}"
  echo "  Buckets:     ${STORAGE_BUCKET_SYSTEM}, ${STORAGE_BUCKET_USER}"
  echo "               ${STORAGE_BUCKET_SYSTEM_TEST}, ${STORAGE_BUCKET_USER_TEST}"
fi
echo "  Redis DB:    ${REDIS_DB}"
echo
info "  cd .worktrees/$WT_NAME && bun run local"
echo

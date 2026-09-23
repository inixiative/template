#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"
PROJECT_NAME="$(project_name "$ROOT_DIR")"
PG_CONTAINER="${PROJECT_NAME}_postgres"

NAME=""
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -*) die "Unknown flag: $arg" ;;
    *) [ -z "$NAME" ] && NAME="$arg" || die "Error: expected one worktree name, got '$NAME' and '$arg'" ;;
  esac
done

if [ -z "$NAME" ]; then
  echo -e "${RED}Usage: $0 <name> [--force]${NC}"
  echo "  <name>   Worktree directory name under .worktrees/ (branch with slashes → dashes)"
  echo "  --force  Destroy even when the worktree has uncommitted or untracked changes"
  echo
  echo "Run 'bun run worktree:list' to see available worktrees."
  exit 1
fi

if [[ "$NAME" =~ (^\.|\.\.|/) ]]; then
  die "Error: Name cannot start with '.' or contain '..' or path separators"
fi

WORKTREE_DIR="$ROOT_DIR/.worktrees/$NAME"
if [ ! -d "$WORKTREE_DIR" ]; then
  die "Error: Worktree '$NAME' not found at $WORKTREE_DIR"
fi

for candidate in "$ROOT_DIR/.worktrees"/*/; do
  candidate="${candidate%/}"
  if [ "$candidate" -ef "$WORKTREE_DIR" ] && [ "$(basename "$candidate")" != "$NAME" ]; then
    warn "Note: '$NAME' is spelled '$(basename "$candidate")' on disk — using that name."
    NAME="$(basename "$candidate")"
    WORKTREE_DIR="$candidate"
  fi
done

HALF_CREATED=0
if is_registered_worktree "$WORKTREE_DIR"; then
  REGISTERED=1
  worktree_shares_main_git "$WORKTREE_DIR" \
    || die "Error: $WORKTREE_DIR does not belong to this repository (its git common dir is not $ROOT_DIR/.git). Refusing to delete an independent repository."
elif GITDIR="$(dot_git_file_target "$WORKTREE_DIR")"; then
  REGISTERED=0
  if gitdir_belongs_to_main "$GITDIR"; then
    HALF_CREATED=1
  elif [ -e "$GITDIR" ]; then
    die "Error: $WORKTREE_DIR is a git worktree whose gitdir ($GITDIR) belongs to another checkout. If that repository moved, run 'git worktree repair' from it. Nothing was deleted."
  else
    die "Error: $WORKTREE_DIR is a git worktree whose gitdir ($GITDIR) is missing and is not under this repository's .git/worktrees/. Run 'git worktree repair' from the repository that owns it, or remove the directory by hand. Nothing was deleted."
  fi
elif [ -d "$WORKTREE_DIR/.git" ]; then
  die "Error: $WORKTREE_DIR is an independent git repository (it has its own .git directory), not a worktree of this one. Refusing to delete it."
else
  die "Error: $WORKTREE_DIR is not a git worktree (no .git file, not registered). Refusing to delete it."
fi

[ "$HALF_CREATED" -eq 0 ] || warn "Warning: $WORKTREE_DIR is a half-created worktree of this repository (gitdir $GITDIR is not registered) — removing the directory and pruning."

print_first_lines() {
  sed -n '1,10{s/^/  /;p;}' <<< "$1"
}

if [ "$REGISTERED" -eq 1 ]; then
  info "$(branch_merge_status "$WORKTREE_DIR")"
  DIRTY="$(git -C "$WORKTREE_DIR" status --porcelain --untracked-files=all 2>/dev/null || true)"
  if [ -n "$DIRTY" ]; then
    if [ "$FORCE" -eq 1 ]; then
      warn "Warning: destroying with uncommitted or untracked changes (--force):"
      print_first_lines "$DIRTY"
    else
      echo -e "${RED}Error: $NAME has uncommitted or untracked changes:${NC}" >&2
      print_first_lines "$DIRTY" >&2
      die "Commit or discard them, or pass --force to destroy anyway."
    fi
  fi
fi

SLOT="$(worktree_marker_slot "$WORKTREE_DIR")"
CLAIMED_SLOTS="$(worktree_slots "$WORKTREE_DIR" | tr '\n' ' ')"
CLAIMED_COUNT="$(echo "$CLAIMED_SLOTS" | wc -w | tr -d ' ')"
if [ "$CLAIMED_COUNT" -gt 1 ]; then
  die "Error: $NAME references more than one slot (marker WORKTREE_SLOT='${SLOT:-none}', env files/registry name slots: ${CLAIMED_SLOTS}).
Refusing to guess which databases are its own. Fix the env files so they agree on one slot, then re-run."
fi
[ -n "$SLOT" ] || SLOT="$(echo "$CLAIMED_SLOTS" | tr -d ' ')"

if [ -z "$SLOT" ]; then
  warn "Warning: No WORKTREE_SLOT found in $WORKTREE_DIR/.env.local"
  warn "Proceeding with worktree removal only (no DB / bucket / Redis / port cleanup)"
else
  valid_slot "$SLOT" || die "Error: WORKTREE_SLOT='$SLOT' in $WORKTREE_DIR/.env.local is not a slot number (1-9). Fix the file, then re-run."
  slot_resources "$SLOT"

  if CLAIMANT="$(slot_claimant "$SLOT" "$WORKTREE_DIR")"; then
    warn "Warning: $(basename "$CLAIMANT") also references slot $SLOT — leaving $DB_LOCAL / $DB_TEST, the buckets, and Redis DB $SLOT in place."
    SHARED_SLOT=1
  else
    SHARED_SLOT=0
  fi

  DOCKER="$(resolve_docker || true)"
  if [ "$SHARED_SLOT" -eq 1 ]; then
    :
  elif [ -z "$DOCKER" ] || ! "$DOCKER" info >/dev/null 2>&1; then
    warn "Warning: Docker is not reachable — slot $SLOT databases, buckets, and Redis DB are NOT cleaned up."
    warn "Start Docker and drop $DB_LOCAL / $DB_TEST by hand, or worktree:create will drop them when it reclaims slot $SLOT."
  else
    if [ "$(container_state "$PG_CONTAINER")" = "true" ]; then
      PSQL=("$DOCKER" exec "$PG_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q)
      info "Dropping databases: $DB_LOCAL, $DB_TEST..."
      if "${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"${DB_LOCAL}\" WITH (FORCE);" \
        && "${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"${DB_TEST}\" WITH (FORCE);"; then
        ok "Databases dropped"
      else
        warn "Warning: Could not drop databases. worktree:create drops them when it reclaims slot $SLOT."
      fi
    else
      warn "Warning: $PG_CONTAINER not running — databases NOT dropped. worktree:create drops them when it reclaims slot $SLOT."
    fi

    info "Removing MinIO buckets for slot ${SLOT}..."
    storage_env_from "$ROOT_DIR/.env.local"
    PATH="$(dirname "$DOCKER"):$PATH" bash "$SCRIPT_DIR/../db/minio-remove.sh" \
      "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
      "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST" \
      || warn "Warning: bucket removal did not complete."

    REDIS_CONTAINER="$(container_on_port 6379)"
    if [ -z "$REDIS_CONTAINER" ]; then
      warn "Warning: nothing is serving localhost:6379 — Redis DB $SLOT not flushed."
    elif "$DOCKER" exec "$REDIS_CONTAINER" redis-cli -n "$SLOT" FLUSHDB >/dev/null; then
      ok "Redis DB $SLOT flushed ($REDIS_CONTAINER)"
    else
      warn "Warning: FLUSHDB $SLOT failed on $REDIS_CONTAINER."
    fi
  fi

  PORTS="$(slot_ports "$SLOT")"
  info "Killing processes on ports: ${PORTS}..."
  for PORT in $PORTS; do
    kill_port_listeners "$PORT"
  done
  unregister_slot "$SLOT" "$WORKTREE_DIR"
fi

info "Removing git worktree..."
if [ "$REGISTERED" -eq 1 ] && git -C "$ROOT_DIR" worktree remove "$WORKTREE_DIR" --force 2>/dev/null; then
  :
else
  [ "$REGISTERED" -eq 1 ] && warn "git worktree remove failed, cleaning up manually..."
  rm -rf "$WORKTREE_DIR"
  git -C "$ROOT_DIR" worktree prune
fi

echo
ok "Worktree '$NAME' destroyed"
if [ -n "$SLOT" ] && [ "${SHARED_SLOT:-0}" -eq 1 ]; then
  warn "Slot $SLOT stays with $(basename "$CLAIMANT")"
elif [ -n "$SLOT" ]; then
  ok "Slot $SLOT freed"
fi
echo

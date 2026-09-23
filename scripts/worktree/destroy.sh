#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"
PROJECT_NAME="$(project_name "$ROOT_DIR")"
PG_CONTAINER="${PROJECT_NAME}_postgres"
MINIO_CONTAINER="${PROJECT_NAME}_minio"

NAME="${1:-}"

if [ -z "$NAME" ]; then
  echo -e "${RED}Usage: $0 <name>${NC}"
  echo "  <name>  Worktree directory name under .worktrees/ (branch with slashes → dashes)"
  echo
  echo "Run 'bun run worktree:list' to see available worktrees."
  exit 1
fi

if echo "$NAME" | grep -qE '(^\.|\.\.|/)'; then
  die "Error: Name cannot start with '.' or contain '..' or path separators"
fi

WORKTREE_DIR="$ROOT_DIR/.worktrees/$NAME"
if [ ! -d "$WORKTREE_DIR" ]; then
  die "Error: Worktree '$NAME' not found at $WORKTREE_DIR"
fi

if is_registered_worktree "$WORKTREE_DIR"; then
  REGISTERED=1
elif [ -f "$WORKTREE_DIR/.git" ]; then
  REGISTERED=0
  warn "Warning: $WORKTREE_DIR is not registered with git (half-created?) — removing the directory and pruning."
else
  die "Error: $WORKTREE_DIR is not a git worktree (no .git file, not registered). Refusing to delete it."
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

    if [ "$(container_state "$MINIO_CONTAINER")" = "true" ]; then
      info "Removing MinIO buckets for slot ${SLOT}..."
      for BUCKET in "$STORAGE_BUCKET_SYSTEM" "$STORAGE_BUCKET_USER" \
                    "$STORAGE_BUCKET_SYSTEM_TEST" "$STORAGE_BUCKET_USER_TEST"; do
        "$DOCKER" run --rm --network "${PROJECT_NAME}_default" \
          -e MC_HOST_local="http://minioadmin:minioadmin@minio:9000" \
          minio/mc:latest rb --force "local/${BUCKET}" >/dev/null 2>&1 || true
      done
      ok "MinIO buckets removed"
    else
      warn "Warning: $MINIO_CONTAINER not running — buckets NOT removed."
    fi

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

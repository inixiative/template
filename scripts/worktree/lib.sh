#!/usr/bin/env bash

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${BLUE}$*${NC}"; }
ok() { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
die() { echo -e "${RED}$*${NC}" >&2; exit 1; }

sedi() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

main_checkout_root() {
  local common
  common="$(git -C "$1" rev-parse --git-common-dir)"
  common="$(cd "$1" && cd "$common" && pwd -P)"
  dirname "$common"
}

default_branch() {
  git -C "$1" symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true
}

env_value() {
  local line value
  line="$(grep -m1 -E "^(export[[:space:]]+)?${2}=" "$1" 2>/dev/null | tr -d '\r' || true)"
  [ -n "$line" ] || return 0
  value="${line#*=}"
  value="${value#\"}"; value="${value%\"}"
  value="${value#\'}"; value="${value%\'}"
  printf '%s\n' "$value"
}

project_name() {
  local name=""
  [ -f "$1/.env" ] && name="$(env_value "$1/.env" PROJECT_NAME)"
  echo "${name:-template}"
}

valid_slot() {
  [[ "$1" =~ ^[1-9]$ ]]
}

resolve_docker() {
  local candidate
  for candidate in "$(command -v docker 2>/dev/null || true)" "$HOME/.docker/bin/docker" /Applications/Docker.app/Contents/Resources/bin/docker; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

container_state() {
  "$DOCKER" inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true
}

container_on_port() {
  "$DOCKER" ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null | head -1
}

slot_ports() {
  echo "3${1}00 3${1}01 3${1}02 8${1}00"
}

slot_resources() {
  local slot="$1"
  WEB_PORT="3${slot}00"
  ADMIN_PORT="3${slot}01"
  SUPERADMIN_PORT="3${slot}02"
  API_PORT="8${slot}00"
  DB_LOCAL="${PROJECT_NAME}_wt_${slot}"
  DB_TEST="${PROJECT_NAME}_test_wt_${slot}"
  REDIS_DB="$slot"
  STORAGE_BUCKET_SYSTEM="${PROJECT_NAME}-system-wt-${slot}"
  STORAGE_BUCKET_USER="${PROJECT_NAME}-user-wt-${slot}"
  STORAGE_BUCKET_SYSTEM_TEST="${PROJECT_NAME}-system-test-wt-${slot}"
  STORAGE_BUCKET_USER_TEST="${PROJECT_NAME}-user-test-wt-${slot}"
}

ensure_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file"; then
    sedi "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

replace_env_var_if_present() {
  local file="$1" key="$2" value="$3"
  [ -f "$file" ] && grep -q "^${key}=" "$file" || return 0
  sedi "s|^${key}=.*|${key}=${value}|" "$file"
}

prepend_slot_marker() {
  local file="$1" slot="$2" tmp
  [ -f "$file" ] || return 0
  tmp="$(mktemp)"
  { echo "WORKTREE_SLOT=${slot}"; grep -vE '^(export[[:space:]]+)?WORKTREE_SLOT=' "$file" || true; } > "$tmp"
  mv "$tmp" "$file"
}

rewrite_database_url() {
  local file="$1" db="$2"
  [ -f "$file" ] && grep -q '^DATABASE_URL=' "$file" || return 0
  sedi -E "s|^(DATABASE_URL=[a-z]+://([^@/[:space:]]+@)?[^/[:space:]]+/)[^?[:space:]]*|\1${db}|" "$file"
  grep -Eq "^DATABASE_URL=[a-z]+://([^@/[:space:]]+@)?[^/[:space:]]+/${db}([?[:space:]]|\$)" "$file"
}

rewrite_redis_db() {
  local file="$1" n="$2"
  [ -f "$file" ] || return 0
  sedi -E "s#^(REDIS(_QUEUE)?_URL=redis://([^@/]*@)?(localhost|127\.0\.0\.1):[0-9]+)(/[0-9]+)?[[:space:]]*\$#\1/${n}#" "$file"
}

env_file_sources() {
  bash -c 'set -a; . "$1"' _ "$1" >/dev/null 2>&1
}

linked_worktrees() {
  git -C "$ROOT_DIR" worktree list --porcelain | sed -n 's/^worktree //p' | grep -vx "$ROOT_DIR" || true
}

is_registered_worktree() {
  linked_worktrees | grep -qx "$1"
}

worktree_env_files() {
  local f
  for f in "$1/.env.local" "$1/.env.test" "$1"/apps/*/.env.local "$1"/apps/*/.env.test; do
    [ -f "$f" ] && echo "$f"
  done
  return 0
}

slots_dir() {
  echo "$ROOT_DIR/.worktrees/.slots"
}

registry_owner() {
  local f
  f="$(slots_dir)/$1"
  [ -f "$f" ] && head -1 "$f" | tr -d '\r' || true
}

register_slot() {
  mkdir -p "$(slots_dir)"
  printf '%s\n' "$2" > "$(slots_dir)/$1"
}

unregister_slot() {
  [ "$(registry_owner "$1")" = "$2" ] && rm -f "$(slots_dir)/$1"
  return 0
}

prune_slot_registry() {
  local f slot owner
  for f in "$(slots_dir)"/*; do
    [ -f "$f" ] || continue
    slot="$(basename "$f")"
    owner="$(registry_owner "$slot")"
    if ! valid_slot "$slot" || [ -z "$owner" ] || ! is_registered_worktree "$owner"; then
      warn "Slot registry entry $slot (${owner:-empty}) points at no registered worktree — removing it."
      rm -f "$f"
    fi
  done
}

worktree_marker_slot() {
  local slot
  slot="$(env_value "$1/.env.local" WORKTREE_SLOT)"
  [ -n "$slot" ] || slot="$(env_value "$1/.env.test" WORKTREE_SLOT)"
  echo "$slot"
}

worktree_slots() {
  local wt="$1" i
  for i in $(seq 1 9); do
    worktree_claims_slot "$wt" "$i" && echo "$i"
  done
  return 0
}

worktree_claims_slot() {
  local wt="$1" slot="$2" f
  [ "$(registry_owner "$slot")" = "$wt" ] && return 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ "$(env_value "$f" WORKTREE_SLOT)" = "$slot" ] && return 0
    grep -Eq "${PROJECT_NAME}_(test_)?wt_${slot}([^0-9]|\$)" "$f" && return 0
  done < <(worktree_env_files "$wt")
  return 1
}

slot_claimant() {
  local slot="$1" exclude="${2:-}" wt
  while IFS= read -r wt; do
    [ -n "$wt" ] && [ -d "$wt" ] && [ "$wt" != "$exclude" ] || continue
    if worktree_claims_slot "$wt" "$slot"; then
      echo "$wt"
      return 0
    fi
  done < <(linked_worktrees)
  return 1
}

kill_port_listeners() {
  local port="$1" pid killed=0 survivors=""
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    kill -9 "$pid" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    if kill -0 "$pid" 2>/dev/null; then
      survivors="${survivors} ${pid}"
    else
      echo "  Killed PID $pid on port $port"
      killed=$((killed + 1))
    fi
  done < <(lsof -ti:"$port" 2>/dev/null || true)
  [ -z "$survivors" ] || warn "  Warning: could not kill PID(s)${survivors} on port $port"
}

STALE_LOCK_SECONDS="${STALE_LOCK_SECONDS:-60}"

lock_root() {
  echo "$ROOT_DIR/.worktrees/.locks"
}

lock_is_stale() {
  local lock="$1" pid age
  if [ -f "$lock/pid" ]; then
    pid="$(tr -d '\r\n' < "$lock/pid")"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 0
    ! kill -0 "$pid" 2>/dev/null
    return
  fi
  age=$(( $(date +%s) - $(stat -f %m "$lock" 2>/dev/null || stat -c %Y "$lock" 2>/dev/null || date +%s) ))
  [ "$age" -gt "$STALE_LOCK_SECONDS" ]
}

claim_slot_lock() {
  local lock
  lock="$(lock_root)/slot-$1"
  mkdir -p "$(lock_root)"
  if [ -d "$lock" ] && lock_is_stale "$lock"; then
    warn "Slot $1 has a lock left by a create that is no longer running — reclaiming it."
    rm -rf "$lock"
  fi
  mkdir "$lock" 2>/dev/null || return 1
  echo $$ > "$lock/pid"
  SLOT_LOCK="$lock"
}

release_slot_lock() {
  [ -n "${SLOT_LOCK:-}" ] && rm -rf "$SLOT_LOCK"
  return 0
}

run_step() {
  local label="$1"
  shift
  info "$label..."
  local out
  if out="$(cd "$WORKTREE_DIR" && "$@" 2>&1)"; then
    return 0
  fi
  echo "$out" | tail -15
  echo -e "${RED}$label failed.${NC}"
  return 1
}

require_artifact() {
  local rel="$1" hint="$2"
  if [ ! -e "$WORKTREE_DIR/$rel" ]; then
    GAPS="${GAPS}  - $rel missing — rerun in the worktree: $hint\n"
  fi
}

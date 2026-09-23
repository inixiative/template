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

env_value() {
  grep -m1 "^${2}=" "$1" 2>/dev/null | cut -d= -f2- || true
}

project_name() {
  local name=""
  [ -f "$1/.env" ] && name="$(env_value "$1/.env" PROJECT_NAME)"
  echo "${name:-$(basename "$1")}"
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

rewrite_database_url() {
  local file="$1" db="$2"
  [ -f "$file" ] && grep -q '^DATABASE_URL=' "$file" || return 0
  sedi -E "s|^(DATABASE_URL=[a-z]+://[^@]+@[^/]+/)[^?[:space:]]*|\1${db}|" "$file"
}

rewrite_redis_db() {
  local file="$1" n="$2"
  [ -f "$file" ] || return 0
  sedi -E "s#^(REDIS(_QUEUE)?_URL=redis://([^@/]*@)?(localhost|127\.0\.0\.1):[0-9]+)(/[0-9]+)?[[:space:]]*\$#\1/${n}#" "$file"
}

linked_worktrees() {
  git -C "$ROOT_DIR" worktree list --porcelain | sed -n 's/^worktree //p' | grep -vx "$ROOT_DIR" || true
}

worktree_env_files() {
  local f
  for f in "$1/.env.local" "$1/.env.test" "$1"/apps/*/.env.local "$1"/apps/*/.env.test; do
    [ -f "$f" ] && echo "$f"
  done
  return 0
}

worktree_claims_slot() {
  local wt="$1" slot="$2" f
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    grep -q "^WORKTREE_SLOT=${slot}\$" "$f" && return 0
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

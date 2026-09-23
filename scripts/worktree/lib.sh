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

file_mtime() {
  if stat --version >/dev/null 2>&1; then stat -c %Y "$1"; else stat -f %m "$1"; fi
}

real_dir() {
  [ -d "$1" ] && (cd "$1" && pwd -P) || printf '%s\n' "$1"
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

env_key_pattern() {
  printf '^(export[[:space:]]+)?%s[[:space:]]*=' "$1"
}

env_line() {
  grep -m1 -E "$(env_key_pattern "$2")" "$1" 2>/dev/null | tr -d '\r' || true
}

env_has_key() {
  [ -f "$1" ] && grep -qE "$(env_key_pattern "$2")" "$1"
}

env_value() {
  local line value
  line="$(env_line "$1" "$2")"
  [ -n "$line" ] || return 0
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  case "$value" in
    \"*)
      value="${value#\"}"
      pattern='^((\\.|[^"\\])*)"'
      [[ "$value" =~ $pattern ]] && value="${BASH_REMATCH[1]}"
      value="${value//\\\"/\"}"
      value="${value//\\\\/\\}"
      ;;
    \'*) value="${value#\'}"; value="${value%%\'*}" ;;
    *) value="${value%%[[:space:]]#*}"; value="${value%"${value##*[![:space:]]}"}" ;;
  esac
  [ -n "$value" ] && printf '%s\n' "$value"
  return 0
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
  for candidate in "$(command -v docker 2>/dev/null || true)" "${HOME:-/nonexistent}/.docker/bin/docker" /Applications/Docker.app/Contents/Resources/bin/docker; do
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
  local names
  names="$("$DOCKER" ps --filter "publish=$1" --format '{{.Names}}' 2>/dev/null || true)"
  printf '%s\n' "${names%%$'\n'*}"
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

sed_replacement() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

set_env_var() {
  local file="$1" key="$2" value="$3" prefix="" line now
  line="$(env_line "$file" "$key")"
  if [ -n "$line" ]; then
    case "$line" in export*) prefix="export " ;; esac
    sedi -E "s|$(env_key_pattern "$key").*|${prefix}${key}=$(sed_replacement "$value")|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
  now="$(env_value "$file" "$key")"
  [ "$now" = "$value" ] || die "Error: could not set $key in $file — wanted '$value', the file now reads '${now:-<empty>}'."
}

ensure_env_var() {
  set_env_var "$1" "$2" "$3"
}

replace_env_var_if_present() {
  env_has_key "$1" "$2" || return 0
  set_env_var "$1" "$2" "$3"
}

require_env_key() {
  local key="$1" f
  shift
  for f in "$@"; do
    [ -n "$(env_value "$f" "$key")" ] && return 0
  done
  die "Error: $key is not set (or is empty) in any of: $* — the slot databases cannot be provisioned without it.
Add it to the root env file (bun run sync-env) or pass --skip-db for an edit-only worktree."
}

copy_env_without_marker() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  grep -vE "$(env_key_pattern WORKTREE_SLOT)" "$src" > "$dst" || true
}

prepend_slot_marker() {
  local file="$1" slot="$2" tmp
  [ -f "$file" ] || return 0
  tmp="$(mktemp)"
  { echo "WORKTREE_SLOT=${slot}"; grep -vE "$(env_key_pattern WORKTREE_SLOT)" "$file" || true; } > "$tmp"
  mv "$tmp" "$file"
}

rewrite_database_url() {
  local file="$1" db="$2" url pattern
  env_has_key "$file" DATABASE_URL || return 0
  url="$(env_value "$file" DATABASE_URL)"
  [ -n "$url" ] || die "Error: DATABASE_URL in $file is empty — cannot point it at $db."
  pattern='^([a-z]+://(.*@)?[^/@[:space:]]+/)([^?]*)(.*)$'
  [[ "$url" =~ $pattern ]] || die "Error: DATABASE_URL in $file ('$url') is not scheme://[user:password@]host[:port]/database — cannot point it at $db."
  set_env_var "$file" DATABASE_URL "${BASH_REMATCH[1]}${db}${BASH_REMATCH[4]}"
}

rewrite_redis_db() {
  local file="$1" n="$2" key url pattern
  pattern='^(redis://([^@/]*@)?(localhost|127\.0\.0\.1):[0-9]+)(/[0-9]+)?$'
  for key in REDIS_URL REDIS_QUEUE_URL REDIS_BULLMQ_URL; do
    env_has_key "$file" "$key" || continue
    url="$(env_value "$file" "$key")"
    [ -n "$url" ] || continue
    [[ "$url" =~ $pattern ]] || continue
    set_env_var "$file" "$key" "${BASH_REMATCH[1]}/${n}"
  done
}

env_file_sources() {
  bash -c 'set -a; . "$1"' _ "$1" >/dev/null 2>&1
}

linked_worktrees() {
  local p root
  root="$(real_dir "$ROOT_DIR")"
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    p="$(real_dir "$p")"
    [ "$p" = "$root" ] && continue
    printf '%s\n' "$p"
  done < <(git -C "$ROOT_DIR" worktree list --porcelain | sed -n 's/^worktree //p')
  return 0
}

is_registered_worktree() {
  local wt
  wt="$(real_dir "$1")"
  [ -n "$(linked_worktrees | grep -xF -- "$wt")" ]
}

worktree_shares_main_git() {
  local common
  common="$(git -C "$1" rev-parse --git-common-dir 2>/dev/null || true)"
  [ -n "$common" ] || return 1
  common="$(cd "$1" && cd "$common" && pwd -P)"
  [ "$common" = "$(real_dir "$ROOT_DIR")/.git" ]
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
  [ "$(real_dir "$(registry_owner "$1")")" = "$(real_dir "$2")" ] && rm -f "$(slots_dir)/$1"
  return 0
}

registry_entries() {
  local f slot
  for f in "$(slots_dir)"/*; do
    [ -f "$f" ] || continue
    slot="$(basename "$f")"
    valid_slot "$slot" || continue
    printf '%s %s\n' "$slot" "$(registry_owner "$slot")"
  done
  return 0
}

registry_duplicates() {
  registry_entries | awk 'NF > 1 { slot = $1; sub(/^[^ ]+ /, ""); slots[$0] = slots[$0] " " slot; n[$0]++ } END { for (o in slots) if (n[o] > 1) print o ":" slots[o] }'
}

REGISTRY_STALE_SECONDS="${REGISTRY_STALE_SECONDS:-120}"

prune_slot_registry() {
  local f slot owner age
  for f in "$(slots_dir)"/*; do
    [ -f "$f" ] || continue
    slot="$(basename "$f")"
    if ! valid_slot "$slot"; then
      warn "Slot registry entry '$slot' is not a slot number — removing it."
      rm -f "$f"
      continue
    fi
    owner="$(registry_owner "$slot")"
    [ -n "$owner" ] && [ -d "$owner" ] && continue
    [ -d "$(lock_root)/slot-$slot" ] && continue
    age=$(( $(date +%s) - $(file_mtime "$f") ))
    [ "$age" -gt "$REGISTRY_STALE_SECONDS" ] || continue
    warn "Slot registry entry $slot (${owner:-empty}) points at a directory that no longer exists — removing it."
    rm -f "$f"
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
  local wt="$1" slot="$2" f owner
  owner="$(registry_owner "$slot")"
  [ -n "$owner" ] && [ "$(real_dir "$owner")" = "$(real_dir "$wt")" ] && return 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ "$(env_value "$f" WORKTREE_SLOT)" = "$slot" ] && return 0
    grep -Eq "(^|[^A-Za-z0-9_])${PROJECT_NAME}_(test_)?wt_${slot}([^0-9]|\$)" "$f" && return 0
  done < <(worktree_env_files "$wt")
  return 1
}

slot_claimant() {
  local slot="$1" exclude="${2:-}" wt
  [ -z "$exclude" ] || exclude="$(real_dir "$exclude")"
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
  local port="$1" pid survivors=""
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
  age=$(( $(date +%s) - $(file_mtime "$lock") ))
  [ "$age" -gt "$STALE_LOCK_SECONDS" ]
}

claim_slot_lock() {
  local lock stale
  lock="$(lock_root)/slot-$1"
  mkdir -p "$(lock_root)"
  if [ -d "$lock" ] && lock_is_stale "$lock"; then
    stale="$lock.stale.$$"
    if mv "$lock" "$stale" 2>/dev/null; then
      warn "Slot $1 has a lock left by a create that is no longer running — reclaiming it."
      rm -rf "$stale"
    fi
  fi
  mkdir "$lock" 2>/dev/null || return 1
  echo $$ > "$lock/pid"
  SLOT_LOCK="$lock"
}

release_slot_lock() {
  [ -n "${SLOT_LOCK:-}" ] && rm -rf "$SLOT_LOCK"
  return 0
}

branch_merge_status() {
  local wt="$1" branch base merged
  branch="$(git -C "$wt" branch --show-current 2>/dev/null || true)"
  base="$(default_branch "$ROOT_DIR")"
  base="${base:-main}"
  merged="$(git -C "$ROOT_DIR" branch --merged "$base" 2>/dev/null | sed 's/^[*+ ]*//' || true)"
  if [ -z "$branch" ]; then
    echo "detached HEAD — merge status unknown"
  elif grep -qxF -- "$branch" <<< "$merged"; then
    echo "branch '$branch' is merged into $base"
  else
    echo "branch '$branch' is NOT merged into $base ($(git -C "$ROOT_DIR" rev-list --count "$base..$branch" 2>/dev/null || echo '?') commit(s) not in $base)"
  fi
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

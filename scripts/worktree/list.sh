#!/usr/bin/env bash
# list.sh — Show all worktrees + the slot/ports they own.
#
# Usage:
#   bun run worktree:list

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

printf "\n%-6s %-35s %-40s %s\n" "Slot" "Name" "Branch" "Ports (web/admin/super/api)"
printf "%-6s %-35s %-40s %s\n" "----" "----" "------" "----------------------------"

while IFS= read -r line; do
  wt_path="$(echo "$line" | awk '{print $1}')"
  branch="$(echo "$line" | sed -n 's/.*\[\(.*\)\].*/\1/p')"
  [ -z "$branch" ] && branch="(detached)"

  name="$(basename "$wt_path")"
  env_file="$wt_path/.env.local"
  slot=""

  if [ -f "$env_file" ]; then
    slot="$(grep -m1 '^WORKTREE_SLOT=' "$env_file" 2>/dev/null | cut -d= -f2 || true)"
  fi

  if [ -z "$slot" ]; then
    if [ "$wt_path" = "$ROOT_DIR" ]; then
      name="(main)"
      slot="0"
      ports="3000 3001 3002 8000"
    else
      slot="-"
      ports="(not configured)"
    fi
  else
    ports="3${slot}00 3${slot}01 3${slot}02 8${slot}00"
  fi

  printf "%-6s %-35s %-40s %s\n" "$slot" "$name" "$branch" "$ports"
done < <(git -C "$ROOT_DIR" worktree list)

echo

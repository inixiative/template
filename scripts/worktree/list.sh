#!/bin/bash
# list.sh - Show all worktrees with their allocated slots and ports
# Usage: scripts/worktree/list.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

printf "\n%-6s %-35s %-40s %s\n" "Slot" "Name" "Branch" "Ports (API / Web / Admin / SA)"
printf "%-6s %-35s %-40s %s\n" "----" "----" "------" "-----"

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
      ports="8000 / 3000 / 3001 / 3002"
    else
      slot="-"
      ports="(not configured)"
    fi
  else
    ports="8${slot}00 / 3${slot}00 / 3${slot}01 / 3${slot}02"
  fi

  printf "%-6s %-35s %-40s %s\n" "$slot" "$name" "$branch" "$ports"
done < <(git -C "$ROOT_DIR" worktree list)

echo ""

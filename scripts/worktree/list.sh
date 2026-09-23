#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"

printf "\n%-6s %-35s %-40s %s\n" "Slot" "Name" "Branch" "Ports (web/admin/super/api)"
printf "%-6s %-35s %-40s %s\n" "----" "----" "------" "----------------------------"

while IFS= read -r line; do
  wt_path="$(echo "$line" | awk '{print $1}')"
  branch="$(echo "$line" | sed -n 's/.*\[\(.*\)\].*/\1/p')"
  [ -z "$branch" ] && branch="(detached)"

  name="$(basename "$wt_path")"
  slot="$(env_value "$wt_path/.env.local" WORKTREE_SLOT)"

  if [ -z "$slot" ]; then
    if [ "$wt_path" = "$ROOT_DIR" ]; then
      name="(main)"
      slot="0"
      ports="$(slot_ports 0)"
    else
      slot="-"
      ports="(not configured)"
    fi
  else
    ports="$(slot_ports "$slot")"
  fi

  printf "%-6s %-35s %-40s %s\n" "$slot" "$name" "$branch" "$ports"
done < <(git -C "$ROOT_DIR" worktree list)

echo

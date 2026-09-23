#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"
MAIN_REAL="$(real_dir "$ROOT_DIR")"

printf "\n%-6s %-35s %-40s %s\n" "Slot" "Name" "Branch" "Ports (web/admin/super/api)"
printf "%-6s %-35s %-40s %s\n" "----" "----" "------" "----------------------------"

print_row() {
  local wt_path="$1" branch="$2" name slot ports
  name="$(basename "$wt_path")"
  slot="$(env_value "$wt_path/.env.local" WORKTREE_SLOT)"
  if [ -z "$slot" ]; then
    if [ "$(real_dir "$wt_path")" = "$MAIN_REAL" ]; then
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
}

wt_path=""
branch=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*) wt_path="${line#worktree }"; branch="" ;;
    "branch "*) branch="${line#branch refs/heads/}" ;;
    detached) branch="(detached)" ;;
    "") [ -n "$wt_path" ] && print_row "$wt_path" "${branch:-(detached)}"; wt_path="" ;;
  esac
done < <(git -C "$ROOT_DIR" worktree list --porcelain; echo)

for i in $(seq 1 9); do
  status="$(lock_status "$i")"
  [ -n "$status" ] && warn "Slot $i: $status"
done

while IFS= read -r problem; do
  [ -n "$problem" ] || continue
  warn "Slot registry entry ${problem} — $(registry_repair_hint)"
done < <(registry_problems)

while IFS= read -r dup; do
  [ -n "$dup" ] || continue
  warn "Slot registry conflict: ${dup%%:*} is registered under slots${dup#*:} — the next create keeps the slot its WORKTREE_SLOT marker names, else the newest entry."
done < <(registry_duplicates)

echo

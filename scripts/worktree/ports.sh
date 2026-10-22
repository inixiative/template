#!/usr/bin/env bash
set -euo pipefail

# Re-applies a checkout's ports from the @inixiative/config port registry to its env files:
# the main checkout gets the project's base ports, a worktree its slot's. Restart running servers after.
#   bun run worktree:ports           this checkout
#   bun run worktree:ports <name>    the worktree .worktrees/<name>

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib.sh"
ROOT_DIR="$(main_checkout_root "$SCRIPT_DIR")"

if [ "$#" -gt 1 ] || [[ "${1:-}" == -* ]]; then
  die "Usage: $0 [<worktree-name>]"
fi
if [ -n "${1:-}" ]; then
  [[ "$1" =~ (^\.|\.\.|/) ]] && die "Error: Name cannot start with '.' or contain '..' or path separators"
  CHECKOUT="$ROOT_DIR/.worktrees/$1"
  is_registered_worktree "$CHECKOUT" || die "Error: $CHECKOUT is not a registered worktree of this repository (bun run worktree:list)."
else
  CHECKOUT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
fi
CHECKOUT="$(real_dir "$CHECKOUT")"

PROJECT_NAME="${PROJECT_NAME:-}"
[ -n "$PROJECT_NAME" ] || [ ! -f "$ROOT_DIR/.env" ] || PROJECT_NAME="$(env_value "$ROOT_DIR/.env" PROJECT_NAME)"
[ -n "$PROJECT_NAME" ] || PROJECT_NAME="$(env_value "$CHECKOUT/.env.local" PROJECT_NAME)"
[ -n "$PROJECT_NAME" ] || die "Error: PROJECT_NAME is not set in $ROOT_DIR/.env or $CHECKOUT/.env.local."

if [ "$CHECKOUT" = "$(real_dir "$ROOT_DIR")" ]; then
  SLOT=0
else
  SLOT="$(worktree_marker_slot "$CHECKOUT")"
  valid_slot "$SLOT" || die "Error: $CHECKOUT has no WORKTREE_SLOT marker (1-9) in .env.local — it was not made by worktree:create."
fi

apply_slot_ports "$CHECKOUT" "$SLOT"
ok "Ports for $(basename "$CHECKOUT") (slot $SLOT, project $PROJECT_NAME): web $WEB_PORT, admin $ADMIN_PORT, superadmin $SUPERADMIN_PORT, api $API_PORT, http $HTTP_PORT"
info "Restart any servers running in that checkout to pick them up."

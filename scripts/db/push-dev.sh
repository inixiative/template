#!/usr/bin/env bash
# Push the current Prisma schema to BOTH the local AND test DBs of this
# worktree. Uses `bun run with <env> api` to compose the environment
# (Infisical → root .env.$ENV → apps/api/.env.$ENV), so DATABASE_URL is
# resolved the same way the api process itself sees it.
#
# Pushes through scripts/db/push-local.sh (--accept-data-loss), which refuses any
# DATABASE_URL that doesn't look local. The safety check runs inside the
# composed shell so a misconfigured env can never reach `prisma db push`.
#
# Worktree-aware: REPO_ROOT walks up from this script's location, and
# `bun run` inside the worktree resolves to the worktree's `with` script,
# so each worktree pushes against its own per-slot DBs.
#
# Usage:
#   bun run db:push:dev

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ANY_FAIL=0
ANY_RAN=0

push() {
  local env="$1"
  echo "── $env"
  set +e
  bun run with "$env" api bash -c '
    set -euo pipefail
    if [ -z "${DATABASE_URL:-}" ]; then
      echo "  skip — no DATABASE_URL after env composition" >&2
      exit 2
    fi
    echo "  $DATABASE_URL"
    ./scripts/db/push-local.sh
  '
  local rc=$?
  set -e
  case "$rc" in
    0) ANY_RAN=1 ;;
    2) ;;  # missing URL — soft skip, not failure
    *) ANY_FAIL=1 ;;
  esac
  echo
}

push local
push test

if [ "$ANY_RAN" -eq 0 ] && [ "$ANY_FAIL" -eq 0 ]; then
  echo "no DATABASE_URLs found via with-env composition for local or test"
  exit 1
fi
[ "$ANY_FAIL" -eq 0 ] || exit 1

echo "── prisma client"
bun run db:generate

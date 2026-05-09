#!/usr/bin/env bash
# Push the current Prisma schema to BOTH the local AND test DBs of this
# worktree. Reads DATABASE_URL from .env.local and .env.test at the repo
# root (which means worktrees, with their own per-slot env files, get
# their own per-slot DBs pushed automatically when the script is run from
# inside the worktree).
#
# Always uses --accept-data-loss + --skip-generate. Dev-only — never run
# this against a remote / shared / prod URL.
#
# Usage:
#   bun run db:push:dev

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Extract DATABASE_URL from a dotenv file. Returns empty string if missing.
get_url() {
  local env_file="$1"
  [ -f "$env_file" ] || { echo ""; return; }
  # Take the last value if multiple DATABASE_URL lines (later wins, like dotenv).
  grep '^DATABASE_URL=' "$env_file" | tail -1 | cut -d= -f2- | sed 's/^"\(.*\)"$/\1/' | sed "s/^'\(.*\)'\$/\\1/"
}

ANY_FAIL=0
ANY_RAN=0

push() {
  local label="$1" url="$2"
  if [ -z "$url" ]; then
    echo "skip $label — no DATABASE_URL"
    return 0
  fi
  # Refuse anything that doesn't look local. Cheap heuristic.
  case "$url" in
    *@localhost*|*@127.0.0.1*|*@host.docker.internal*) ;;
    *)
      echo "skip $label — DATABASE_URL not local ($url). push-dev refuses non-local targets." >&2
      ANY_FAIL=1
      return 0
      ;;
  esac
  echo "── $label  $url"
  if DATABASE_URL="$url" bun run --cwd packages/db prisma db push --accept-data-loss; then
    ANY_RAN=1
  else
    ANY_FAIL=1
  fi
  echo
}

push "local" "$(get_url .env.local)"
push "test"  "$(get_url .env.test)"

if [ "$ANY_RAN" -eq 0 ] && [ "$ANY_FAIL" -eq 0 ]; then
  echo "no DATABASE_URLs found in .env.local or .env.test"
  exit 1
fi
[ "$ANY_FAIL" -eq 0 ]

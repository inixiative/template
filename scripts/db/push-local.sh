#!/usr/bin/env bash
# Destructive schema push for this worktree's throwaway local and test databases; refuses a non-local DATABASE_URL.
set -euo pipefail

case "${DATABASE_URL:-}" in
  *@localhost*|*@127.0.0.1*|*@host.docker.internal*) ;;
  *)
    echo "  push-local refuses a non-local DATABASE_URL" >&2
    exit 3
    ;;
esac

# why: Prisma refuses --accept-data-loss under an AI agent unless this holds the user's consent text
export PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="These are test databases that are worktree-aware in a throwaway Docker local container. Please do not take them as anything to protect."

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bun run --cwd "$REPO_ROOT/packages/db" prisma db push --accept-data-loss "$@"

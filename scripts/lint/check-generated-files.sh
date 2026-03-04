#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TRACKED_GENERATED="$(git ls-files | grep -E '(^|/)(routeTree\.gen\.ts|[^/]+\.gen\.ts|[^/]+\.generated\.ts)$' || true)"

if [[ -z "$TRACKED_GENERATED" ]]; then
  exit 0
fi

echo "Generated files should not be tracked in git."
echo "Run generation locally and keep generated outputs ignored."
echo
echo "$TRACKED_GENERATED" | sed 's/^/  /'
echo
echo "One-time cleanup command:"
echo "  git ls-files | grep -E '(routeTree\\.gen\\.ts|\\.gen\\.ts|\\.generated\\.ts)$' | xargs git rm --cached"
exit 1

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

pattern='new[[:space:]]+(OpenAPIHono|Hono)\b'

matches=$(grep -rEn \
  --include='*.test.ts' \
  --include='*.test.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  --exclude-dir=.worktrees \
  --exclude-dir=rule-violations \
  "$pattern" . 2>/dev/null || true)

if [[ -n "$matches" ]]; then
  echo "Found tests building a bare Hono app. A bare app has no validation hook, error handler or request context, so it answers with shapes production never sends. Mount routes and middleware through createTestApp (#tests/createTestApp) instead:"
  echo "$matches"
  exit 1
fi

echo "No bare test apps found."

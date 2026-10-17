#!/usr/bin/env bash
set -euo pipefail

# The db client registers the test tracker in every test process (packages/db/src/client.ts), so a
# test never calls registerTestTracker() itself (DB-004). A file that had to opt in is a file that
# could forget to, and then its cleanupTouchedTables(db) cleans nothing.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

VIOLATIONS="$(git grep -nE 'registerTestTracker[[:space:]]*\(' -- 'apps/**/*.ts' 'apps/**/*.tsx' 'packages/**/*.ts' 'tests/**/*.ts' \
  | grep -v '^packages/db/src/client\.ts:' \
  | grep -v '^packages/db/src/test/testTracker\.ts:' \
  | grep -v ':[[:space:]]*//' || true)"

[[ -z "$VIOLATIONS" ]] && exit 0

echo "Found in-file registerTestTracker() calls."
echo "The db client registers the test tracker in every test process; remove the call."
echo
echo "$VIOLATIONS" | sed 's/^/  /'
exit 1

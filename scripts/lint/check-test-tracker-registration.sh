#!/usr/bin/env bash
set -euo pipefail

# The db client registers the test tracker in every test process (packages/db/src/client.ts), so a
# test never calls registerTestTracker() itself (DB-004). A file that had to opt in is a file that
# could forget to, and then its cleanupTouchedTables(db) cleans nothing.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(git grep -l 'registerTestTracker' -- 'apps/**/*.ts' 'apps/**/*.tsx' 'packages/**/*.ts' 'tests/**/*.ts' \
  | grep -v -e '^packages/db/src/client\.ts$' -e '^packages/db/src/test/testTracker\.ts$' || true)

[[ "${#FILES[@]}" -eq 0 ]] && exit 0

bun scripts/lint/lib/testTrackerRegistration.ts "${FILES[@]}"

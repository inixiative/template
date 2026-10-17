#!/usr/bin/env bash
set -euo pipefail

# Tests never delete rows by hand in an after hook (DB-004). The db client registers the test tracker
# in every test process, the tracker records each table a test writes, and cleanupTouchedTables(db)
# truncates them. A delete/deleteMany/TRUNCATE/DELETE FROM in afterEach/afterAll either duplicates
# that or hides a write the tracker missed.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

FILES=()
while IFS= read -r file; do
  FILES+=("$file")
done < <(git ls-files 'apps/**/*.test.ts' 'apps/**/*.test.tsx' 'packages/**/*.test.ts' 'packages/**/*.test.tsx' 'tests/**/*.test.ts')

[[ "${#FILES[@]}" -eq 0 ]] && exit 0

bun scripts/lint/lib/testHandCleanup.ts "${FILES[@]}"

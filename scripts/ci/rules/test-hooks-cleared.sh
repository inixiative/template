#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping test-hooks-cleared."
  exit 0
fi

# The db hook registry is one per process and tests run in random order, so a
# hook a test file registers and leaves behind runs in whichever file comes
# next. A test file that registers hooks must also clear them, and must
# register inside a lifecycle hook: a registration at import time runs once,
# so it is gone after the first clear.
test_files=$(grep -rlE \
  --include='*.test.ts' \
  --include='*.test.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  'register[A-Za-z]*Hooks?\(' "${scan_roots[@]}" 2>/dev/null || true)

if [[ -z "$test_files" ]]; then
  echo "No db hook registration in tests."
  exit 0
fi

never_cleared=()
at_import=()
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  if ! grep -Eq 'clearHookRegistry|snapshotHookRegistry|unregisterDbHook\(' "$file"; then
    never_cleared+=("$file")
  fi
  if grep -Eq '^register[A-Za-z]*Hooks?\(' "$file"; then
    at_import+=("$file")
  fi
done <<< "$test_files"

exit_code=0

if [[ "${#never_cleared[@]}" -gt 0 ]]; then
  echo "Test files register db hooks but never clear them (clearHookRegistry in afterEach/afterAll):"
  printf '  %s\n' "${never_cleared[@]}"
  exit_code=1
fi

if [[ "${#at_import[@]}" -gt 0 ]]; then
  echo "Test files register db hooks at import time; register in beforeEach/beforeAll instead:"
  printf '  %s\n' "${at_import[@]}"
  exit_code=1
fi

if [[ "$exit_code" -eq 0 ]]; then
  echo "Every test file that registers db hooks clears them."
fi

exit "$exit_code"

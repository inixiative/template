#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping no-raw-global-assign-in-tests."
  exit 0
fi

# Forbid raw `globalThis.X = ...` assignment in test files. Use
# `spyOn(globalThis, 'X').mockImplementation(...)` instead — bun's spy has a
# managed lifecycle (mockRestore / mock.restore in afterEach) that raw
# assignment doesn't, so a bug in cleanup silently leaks state into the next
# test file.
pattern='globalThis\.[A-Za-z_][A-Za-z0-9_]*[[:space:]]*='

matches=$(grep -rEn \
  --include='*.test.ts' \
  --include='*.test.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  "$pattern" "${scan_roots[@]}" 2>/dev/null || true)

if [[ -n "$matches" ]]; then
  echo "Found raw globalThis assignments in test files. Use spyOn(globalThis, 'X').mockImplementation(...) so bun's mock.restore() can clean up:"
  echo "$matches"
  exit 1
fi

echo "No raw globalThis assignments in test files."

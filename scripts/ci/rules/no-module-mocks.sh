#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping no-module-mocks."
  exit 0
fi

# Forbid `mock.module(...)` — module mocks are heavy, leak across files in a
# bun test run, and almost always indicate a missing seam (DI, fake registry,
# adapter pattern, etc.). Refactor the production code so the test can swap
# behavior without rewriting the module graph.
#
# Matches: bun's `mock.module(` and jest/vitest-style `jest.mock(`,
# `vi.mock(`, `vitest.mock(` calls.
pattern='(mock\.module|jest\.mock|vi\.mock|vitest\.mock)[[:space:]]*\('

matches=$(grep -rEn \
  --include='*.ts' \
  --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  "$pattern" "${scan_roots[@]}" 2>/dev/null || true)

if [[ -n "$matches" ]]; then
  echo "Found module-level mocks. Module mocks leak across files in a bun test run and usually indicate a missing seam — refactor the production code to accept a fake/adapter (DI, registry, etc.) instead of replacing the module:"
  echo "$matches"
  exit 1
fi

echo "No module-level mocks found."

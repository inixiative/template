#!/usr/bin/env bash
set -euo pipefail

# Detect env mutation in test files.
#
# `process.env.<X> = …` (and any `env.<X> = …`) is process-global. An assignment in one
# test file leaks into every later file in the single-process bun worker and breaks
# unrelated tests nondeterministically (wrong env-gated branch, wrong key, silent no-op
# transports, …).
#
# To vary env-conditional behavior, register an override via the seam in
# @template/shared/utils: `setEnvOverride(key, value)` (cleared after every test by the
# global backstop) or the scoped `withEnv({…}, fn)` — reads resolve override ?? real,
# nothing mutates the shared env. Put static config/creds in .env.test. Comparisons
# (===) and reads are fine — only assignments flag.

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_dirs=()
for dir in apps packages; do
  if [[ -d "$dir" ]]; then
    scan_dirs+=("$dir")
  fi
done

if [[ "${#scan_dirs[@]}" -eq 0 ]]; then
  echo "No source directories found to scan."
  exit 0
fi

# Assignment (incl. ??= / ||=) to env.<UPPER> or process.env.<UPPER>. The trailing
# [^=] excludes comparisons (==, ===). `process.env.X` matches via its `env.X` tail.
VIOLATIONS=$(
  grep -rnE 'env\.[A-Z_]+[[:space:]]*(\?\?|\|\|)?=[^=]' "${scan_dirs[@]}" \
    --include='*.test.ts' --include='*.test.tsx' \
    2>/dev/null \
  | grep -v ':[[:space:]]*//' \
  | grep -v node_modules \
  || true
)

if [[ -n "$VIOLATIONS" ]]; then
  echo "=== env mutation detected in test files ==="
  echo "Assigning env.<X> / process.env.<X> is process-global and leaks across the"
  echo "single-process test suite, breaking unrelated tests nondeterministically."
  echo "Register an override instead: setEnvOverride(key, value) or withEnv({…}, fn)"
  echo "from @template/shared/utils; put static config/creds in .env.test."
  echo ""
  echo "$VIOLATIONS"
  echo ""
  exit 1
fi

echo "No environment mutation found in test files."
exit 0

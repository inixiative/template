#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping no-inline-env-coercion."
  exit 0
fi

# Forbid inline coercion of process.env.* values. Casts and defaults belong in
# the central zod env schema (apps/<app>/src/config/env.ts) so the value is
# typed/coerced once at boot — not per call site.
pattern='(Number\.parseInt|Number\.parseFloat|parseInt|parseFloat|Boolean|Number)[[:space:]]*\([[:space:]]*process\.env\.'

matches=$(grep -rEn \
  --include='*.ts' \
  --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  --exclude='*.test.ts' \
  --exclude='*.test.tsx' \
  "$pattern" "${scan_roots[@]}" 2>/dev/null || true)

# Allow the canonical env-casting files; that's where coercion is supposed to live.
filtered=$(echo "$matches" | grep -Ev '/config/env\.ts:|/lib/encryption/envValidation\.ts:' || true)

if [[ -n "$filtered" ]]; then
  echo "Found inline process.env coercion. Add the var to your zod env schema (e.g. apps/api/src/config/env.ts) with z.coerce.number()/z.coerce.boolean() and a default, then read process.env.X directly:"
  echo "$filtered"
  exit 1
fi

echo "No inline process.env coercion found."

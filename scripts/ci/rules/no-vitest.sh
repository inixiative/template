#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

package_json_files=()
if [[ -f package.json ]]; then
  package_json_files+=(package.json)
fi

while IFS= read -r file; do
  package_json_files+=("$file")
done < <(find apps packages -name 'package.json' -not -path '*/node_modules/*' 2>/dev/null || true)

if [[ "${#package_json_files[@]}" -gt 0 ]]; then
  if grep -ln '"vitest"' "${package_json_files[@]}" >/dev/null 2>&1; then
    echo "Found forbidden vitest dependency entries:"
    grep -Hn '"vitest"' "${package_json_files[@]}"
    exit 1
  fi
fi

scan_roots=()
for dir in apps packages tests; do
  if [[ -d "$dir" ]]; then
    scan_roots+=("$dir")
  fi
done

if [[ "${#scan_roots[@]}" -gt 0 ]]; then
  if grep -rn --include='*.ts' --include='*.tsx' "from 'vitest'\|from \"vitest\"" "${scan_roots[@]}" >/dev/null 2>&1; then
    echo "Found forbidden vitest imports:"
    grep -rn --include='*.ts' --include='*.tsx' "from 'vitest'\|from \"vitest\"" "${scan_roots[@]}"
    exit 1
  fi
fi

echo "No vitest usage found."

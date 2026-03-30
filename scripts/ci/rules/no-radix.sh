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
  if grep -ln '"@radix-ui/' "${package_json_files[@]}" >/dev/null 2>&1; then
    echo "Found forbidden @radix-ui dependency entries (use React Aria instead):"
    grep -Hn '"@radix-ui/' "${package_json_files[@]}"
    exit 1
  fi
fi

scan_roots=()
for dir in apps packages; do
  if [[ -d "$dir" ]]; then
    scan_roots+=("$dir")
  fi
done

if [[ "${#scan_roots[@]}" -gt 0 ]]; then
  if grep -rn --include='*.ts' --include='*.tsx' "from '@radix-ui/\|from \"@radix-ui/" "${scan_roots[@]}" >/dev/null 2>&1; then
    echo "Found forbidden @radix-ui imports (use React Aria instead):"
    grep -rn --include='*.ts' --include='*.tsx' "from '@radix-ui/\|from \"@radix-ui/" "${scan_roots[@]}"
    exit 1
  fi
fi

echo "No @radix-ui usage found."

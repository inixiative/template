#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

package_json_files=()
if [[ -f package.json ]]; then
  package_json_files+=(package.json)
fi

if [[ -d apps || -d packages ]]; then
  while IFS= read -r file; do
    package_json_files+=("$file")
  done < <(rg --files apps packages -g 'package.json' 2>/dev/null || true)
fi

if [[ "${#package_json_files[@]}" -gt 0 ]]; then
  if rg --line-number --no-heading '"vitest"\s*:' "${package_json_files[@]}" >/dev/null; then
    echo "Found forbidden vitest dependency entries:"
    rg --line-number --no-heading '"vitest"\s*:' "${package_json_files[@]}"
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
  if rg --line-number --no-heading "from 'vitest'|from \"vitest\"" "${scan_roots[@]}" -g'*.ts' -g'*.tsx' >/dev/null; then
    echo "Found forbidden vitest imports:"
    rg --line-number --no-heading "from 'vitest'|from \"vitest\"" "${scan_roots[@]}" -g'*.ts' -g'*.tsx'
    exit 1
  fi
fi

echo "No vitest usage found."

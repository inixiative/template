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
  if grep -ln '"jest\|"@jest/globals\|"@types/jest\|"ts-jest\|"babel-jest\|"jest-environment-jsdom\|"jest-mock' "${package_json_files[@]}" >/dev/null 2>&1; then
    echo "Found forbidden jest dependency entries:"
    grep -Hn '"jest\|"@jest/globals\|"@types/jest\|"ts-jest\|"babel-jest\|"jest-environment-jsdom\|"jest-mock' "${package_json_files[@]}"
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
  if grep -rn --include='*.ts' --include='*.tsx' "from 'jest'\|from \"jest\"\|from '@jest/globals'\|from \"@jest/globals\"" "${scan_roots[@]}" >/dev/null 2>&1; then
    echo "Found forbidden jest imports:"
    grep -rn --include='*.ts' --include='*.tsx' "from 'jest'\|from \"jest\"\|from '@jest/globals'\|from \"@jest/globals\"" "${scan_roots[@]}"
    exit 1
  fi

  if grep -rn --include='*.ts' --include='*.tsx' '\bjest\.' "${scan_roots[@]}" >/dev/null 2>&1; then
    echo "Found forbidden jest global usage:"
    grep -rn --include='*.ts' --include='*.tsx' '\bjest\.' "${scan_roots[@]}"
    exit 1
  fi
fi

echo "No jest usage found."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

scan_roots=()
for dir in apps packages; do
  [[ -d "$dir" ]] && scan_roots+=("$dir")
done

if [[ "${#scan_roots[@]}" -eq 0 ]]; then
  echo "No scan roots (apps/, packages/); skipping lua-in-queries."
  exit 0
fi

# A Redis Lua script is a query: it lives in its module's queries/ folder, one script and the one
# function that evals it per file, so atomicity arguments sit next to the script they defend.
matches=$(grep -rEln \
  --include='*.ts' \
  --exclude='*.test.ts' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated \
  "redis\.call\(" "${scan_roots[@]}" 2>/dev/null \
  | grep -v '/queries/' || true)

if [[ -n "$matches" ]]; then
  echo "Found Redis Lua scripts outside a queries/ folder. Move each script to <module>/queries/<name>.ts with its eval wrapper:"
  echo "$matches"
  exit 1
fi

echo "All Redis Lua scripts live under queries/."

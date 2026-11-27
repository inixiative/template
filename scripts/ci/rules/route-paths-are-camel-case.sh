#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

route_roots=()
for dir in apps/*/app/routes; do
  if [[ -d "$dir" ]]; then
    route_roots+=("$dir")
  fi
done

if [[ "${#route_roots[@]}" -eq 0 ]]; then
  echo "No route directories found."
  exit 0
fi

kebab_directories="$(find "${route_roots[@]}" -type d -name '*-*' -not -path '*/node_modules/*' | sort)"

if [[ -n "$kebab_directories" ]]; then
  echo "Found kebab-case route directories (route paths are camelCase, e.g. accountSettings/; Biome checks the file names):"
  echo "$kebab_directories"
  exit 1
fi

echo "All route directories are camelCase."

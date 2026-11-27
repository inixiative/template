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

kebab_paths="$(find "${route_roots[@]}" -name '*-*' -not -path '*/node_modules/*' | sort)"

if [[ -n "$kebab_paths" ]]; then
  echo "Found kebab-case route files or directories (route paths are camelCase, e.g. resetPassword.tsx):"
  echo "$kebab_paths"
  exit 1
fi

echo "All route files are camelCase."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

rebac_dir="packages/permissions/src/rebac"

if [[ ! -d "$rebac_dir" ]]; then
  echo "No rebac directory: $rebac_dir"
  exit 0
fi

VIOLATIONS=$(
  grep -rnE "(field|path):[[:space:]]*['\"]([^'\"]*\.)?full['\"]" "$rebac_dir" --include='*.ts' \
  | grep -vE '\.test\.ts:' \
  || true
)

if [[ -n "$VIOLATIONS" ]]; then
  echo "The rebac schema reads \`full\`:"
  echo "\`full\` is inheritance, not a permission rule: a full delegate skips to its owner when"
  echo "permissions are installed. No rule reads it, on the record or on the actor."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "The rebac schema never reads full."

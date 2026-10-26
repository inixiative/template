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
  grep -rnE "field:[[:space:]]*['\"]full['\"]" "$rebac_dir" --include='*.ts' \
  | grep -vE '\.test\.ts:' \
  || true
)

if [[ -n "$VIOLATIONS" ]]; then
  echo "The rebac schema reads \`full\`:"
  echo "\`full\` is inheritance, not a permission rule: a full delegate skips to its owner when"
  echo "permissions are installed, and setting it takes \`own\` on the owner. Keep it out of the schema."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "The rebac schema never reads full."

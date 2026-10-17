#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# A raw HTTPException answers with plain text and no requestId. API code throws
# makeError (#/lib/errors), which builds the standard error envelope.
#
# Exempt: apps/api/src/lib/errors (AppError extends HTTPException there) and test code.
VIOLATIONS=""
if [[ -d apps/api/src ]]; then
  VIOLATIONS=$(
    grep -rEn "new HTTPException\b" apps/api/src --include='*.ts' 2>/dev/null \
    | grep -vE "apps/api/src/lib/errors/|\.test\.ts|/tests?/|/__tests__/" \
    || true
  )
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found raw HTTPException throws in API code:"
  echo "Throw makeError({ status, message }) from #/lib/errors instead — it answers"
  echo "with the standard envelope { error, message, guidance, requestId }."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No raw HTTPException throws found."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# Raw $transaction bypasses db.txn()'s AsyncLocalStorage store, so the mutationLifeCycle
# extension's isInTxn() reads false inside it — every mutation then reissues into its own
# *separate* db.txn(), defeating atomicity. App and package code must use db.txn(fn),
# which sets the store so writes + hooks run on the one txn connection.
#
# Exempt: packages/db/src/client.ts (db.txn is built on top of db.raw.$transaction there —
# the one allowed call site), the generated Prisma client, and test code.
search_dirs=()
for d in apps packages; do
  [[ -d "$d" ]] && search_dirs+=("$d")
done

VIOLATIONS=""
if [[ "${#search_dirs[@]}" -gt 0 ]]; then
  VIOLATIONS=$(
    grep -rEn "\.\\\$transaction\(" "${search_dirs[@]}" --include='*.ts' 2>/dev/null \
    | grep -vE "/generated/|packages/db/src/client\.ts|\.test\.ts|/tests?/|/__tests__/" \
    || true
  )
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found raw \$transaction calls (these bypass db.txn's transaction propagation):"
  echo "Use db.txn(fn) instead — it sets the AsyncLocalStorage store so the"
  echo "mutationLifeCycle extension runs writes + per-row hooks on the txn connection."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No raw \$transaction calls found."

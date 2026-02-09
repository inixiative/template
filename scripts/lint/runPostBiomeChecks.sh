#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CHECKS=(
  "./scripts/lint/checkImportAliases.sh"
  "./scripts/lint/checkGeneratedFiles.sh"
)

for check in "${CHECKS[@]}"; do
  "$check"
done

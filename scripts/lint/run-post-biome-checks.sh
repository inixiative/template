#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CHECKS=(
  "./scripts/lint/check-import-aliases.sh"
  "./scripts/lint/check-generated-files.sh"
  "./scripts/lint/check-finder-duplicates.sh --check"
  "./scripts/lint/check-test-hand-cleanup.sh"
  "./scripts/lint/check-test-tracker-registration.sh"
)

for check in "${CHECKS[@]}"; do
  eval "$check"
done

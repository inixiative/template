#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

schema_dir="packages/db/prisma/schema"

if [[ ! -d "$schema_dir" ]]; then
  echo "Prisma schema directory not found: $schema_dir"
  exit 1
fi

if rg --line-number --no-heading '@@?map\s*\(' "$schema_dir" -g'*.prisma' >/dev/null; then
  echo "Found forbidden Prisma map directives (@map/@@map):"
  rg --line-number --no-heading '@@?map\s*\(' "$schema_dir" -g'*.prisma'
  exit 1
fi

echo "No Prisma map directives found."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

schema_dir="packages/db/prisma/schema"

if [[ ! -d "$schema_dir" ]]; then
  echo "Prisma schema directory not found: $schema_dir"
  exit 1
fi

if grep -rn '@@\?map\s*(' "$schema_dir" --include='*.prisma' >/dev/null 2>&1; then
  echo "Found forbidden Prisma map directives (@map/@@map):"
  grep -rn '@@\?map\s*(' "$schema_dir" --include='*.prisma'
  exit 1
fi

echo "No Prisma map directives found."

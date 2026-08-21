#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

schema_dir="packages/db/prisma/schema"

if [[ ! -d "$schema_dir" ]]; then
  echo "Prisma schema directory not found: $schema_dir"
  exit 1
fi

# Ban field-level @map and table-level @@map. We do not rename columns or tables — the
# Prisma field/model name IS the underlying DB identifier (no silent transformations).
# Enum-value @map (legacy stored enum strings that can't be migrated cheaply) is allowed,
# so we only inspect `model` blocks, where both field @map and @@map live.
VIOLATIONS=$(
  find "$schema_dir" -name '*.prisma' -type f -print0 \
  | xargs -0 awk '
      FNR == 1 { block = "" }
      /^[[:space:]]*model[[:space:]]/ { block = "model"; next }
      /^[[:space:]]*(enum|type|view|generator|datasource)[[:space:]]/ { block = "other"; next }
      /^[[:space:]]*}/ { block = ""; next }
      block == "model" && !/^[[:space:]]*\/\// && /@@?map[[:space:]]*\(/ { printf "%s:%d:%s\n", FILENAME, FNR, $0 }
    ' 2>/dev/null \
  || true
)

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found forbidden Prisma @map/@@map directives (field or table maps):"
  echo "We do not rename columns or tables — the Prisma field/model name is the DB identifier."
  echo "Remove the @map/@@map and add a migration that renames the column/table to match."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No field or table @map/@@map directives found."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

has_error=0
ui_src="packages/ui/src"

if [[ ! -d "$ui_src" ]]; then
  echo "UI source directory not found: $ui_src"
  exit 1
fi

while IFS= read -r file; do
  if grep -q '@template/db/test' "$file"; then
    if ! grep -q '__serialize()' "$file"; then
      echo "UI test imports @template/db/test but does not serialize factory entities: $file"
      has_error=1
    fi
  fi
done < <(find "$ui_src" -name '*.test.ts' 2>/dev/null)

if grep -rn '__serialize()\s*as\s*any' "$ui_src" --include='*.test.ts' >/dev/null 2>&1; then
  echo "Found forbidden '__serialize() as any' casts in UI tests:"
  grep -rn '__serialize()\s*as\s*any' "$ui_src" --include='*.test.ts'
  has_error=1
fi

if [[ "$has_error" -ne 0 ]]; then
  exit 1
fi

echo "UI serialized factory rules passed."

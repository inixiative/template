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
  if rg --line-number --no-heading '@template/db/test' "$file" >/dev/null; then
    if ! rg --line-number --no-heading '__serialize\(\)' "$file" >/dev/null; then
      echo "UI test imports @template/db/test but does not serialize factory entities: $file"
      has_error=1
    fi
  fi
done < <(rg --files "$ui_src" -g'*.test.ts')

if rg --line-number --no-heading '__serialize\(\)\s+as\s+any' "$ui_src" -g'*.test.ts' >/dev/null; then
  echo "Found forbidden '__serialize() as any' casts in UI tests:"
  rg --line-number --no-heading '__serialize\(\)\s+as\s+any' "$ui_src" -g'*.test.ts'
  has_error=1
fi

if [[ "$has_error" -ne 0 ]]; then
  exit 1
fi

echo "UI serialized factory rules passed."

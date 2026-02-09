#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TARGETS=(
  "apps/api/src"
  "apps/web/app"
  "apps/admin/app"
  "apps/superadmin/app"
  "packages/shared/src"
  "packages/ui/src"
)

MATCHES=$(grep -R -n -E "(import|export)[[:space:]].*from ['\"]\.{1,2}/" \
  "${TARGETS[@]}" \
  --include='*.ts' \
  --include='*.tsx' \
  --exclude='*.gen.ts' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=generated || true)

if [[ -z "$MATCHES" ]]; then
  exit 0
fi

FAILED=0
OUTPUT=()

while IFS= read -r entry; do
  [[ -z "$entry" ]] && continue

  file=${entry%%:*}
  rest=${entry#*:}
  line=${rest%%:*}
  text=${rest#*:}
  base=$(basename "$file")

  if [[ "$text" =~ ^[[:space:]]*// ]] || [[ "$text" =~ ^[[:space:]]*\* ]]; then
    continue
  fi

  if [[ "$base" =~ ^index\.tsx?$ ]] && [[ "$text" =~ ^[[:space:]]*export[[:space:]] ]]; then
    continue
  fi

  FAILED=1
  OUTPUT+=("$file:$line:$text")
done <<< "$MATCHES"

if [[ "$FAILED" -eq 1 ]]; then
  echo "Relative imports are not allowed. Use #/ or @template/ aliases."
  echo "Allowed exception: barrel re-exports in index.ts/index.tsx only."
  echo
  for row in "${OUTPUT[@]}"; do
    echo "  $row"
  done
  exit 1
fi

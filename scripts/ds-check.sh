#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking design-system hardcoded colors..."
COLOR_MATCHES=$(grep -R -n -E "(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\()" \
  packages/ui/src/components/primitives \
  packages/ui/src/pages \
  --include='*.ts' \
  --include='*.tsx' \
  --exclude-dir=node_modules || true)

if [[ -n "$COLOR_MATCHES" ]]; then
  COLOR_MATCHES=$(echo "$COLOR_MATCHES" | grep -v "// ds-ignore" | grep -v "theme.css" || true)
fi

if [[ -n "$COLOR_MATCHES" ]]; then
  echo "ERROR: Hardcoded colors found. Use design tokens."
  echo
  echo "$COLOR_MATCHES"
  exit 1
fi

echo "Checking design-system hardcoded UI strings..."
STRING_TARGETS=(
  "packages/ui/src/components/primitives"
)

if [[ -d "packages/ui/src/components/compositions" ]]; then
  STRING_TARGETS+=("packages/ui/src/components/compositions")
fi

STRING_MATCHES=$(grep -R -n -E '(placeholder|aria-label|title|alt)="[A-Za-z]' \
  "${STRING_TARGETS[@]}" \
  --include='*.tsx' \
  --exclude-dir=node_modules || true)

if [[ -n "$STRING_MATCHES" ]]; then
  STRING_MATCHES=$(echo "$STRING_MATCHES" | grep -v "// ds-ignore" || true)
fi

if [[ -n "$STRING_MATCHES" ]]; then
  echo "ERROR: Hardcoded strings found in DS primitives/compositions. Accept translated strings as props."
  echo
  echo "$STRING_MATCHES"
  exit 1
fi

echo "Checking disallowed Tailwind hardcoded color classes..."
CLASS_MATCHES=$(grep -R -n -E 'className=.*(bg-(blue|red|green|yellow|purple|indigo|pink|orange)-[0-9]{2,3}|text-(blue|red|green|yellow|purple|indigo|pink|orange)-[0-9]{2,3})' \
  packages/ui/src/components/primitives \
  --include='*.tsx' \
  --exclude-dir=node_modules || true)

if [[ -n "$CLASS_MATCHES" ]]; then
  CLASS_MATCHES=$(echo "$CLASS_MATCHES" | grep -v "// ds-ignore" || true)
fi

if [[ -n "$CLASS_MATCHES" ]]; then
  echo "ERROR: Hardcoded Tailwind color classes found in DS primitives. Use semantic token classes."
  echo
  echo "$CLASS_MATCHES"
  exit 1
fi

echo "DS checks passed."

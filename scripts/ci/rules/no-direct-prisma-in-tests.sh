#!/usr/bin/env bash
set -euo pipefail

# Tests must create rows via the factories in @template/db/test — bare db.<model>.create()
# skips FK-context auto-resolution and touched-table tracking, and drifts from the
# canonical defaults.
#
# Exempt: factory implementation files, packages/db/src/test/** (db-layer tests exercising
# the raw client seam itself), and commented-out lines.

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

EXCLUDE='/factories/|/factoryRegistry|packages/db/src/test/'
PATTERN='\(prisma\|testApp\.prisma\|db\|ctx\.db\)\.\w\+\.create\b'

VIOLATIONS=""

# Real repo (has .git) = diff mode: only check test files changed vs the base branch, so a
# pre-existing violation elsewhere never fails an unrelated PR — the tree converges as
# files are touched. Fixture directory (no .git) = scan all test files under apps/ +
# packages/. `.git` is a dir in a normal checkout and a file in a worktree (-e).
if [[ -e "$ROOT_DIR/.git" ]]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  MERGE_BASE=$(git merge-base "origin/${BASE_REF}" HEAD 2>/dev/null || true)

  FILES=()
  if [[ -n "$MERGE_BASE" ]]; then
    while IFS= read -r file; do
      [[ -f "$file" ]] || continue
      case "$file" in
        apps/*.test.ts | apps/*.test.tsx | packages/*.test.ts | packages/*.test.tsx) FILES+=("$file") ;;
      esac
    done < <(git diff --name-only --diff-filter=AM "$MERGE_BASE"...HEAD 2>/dev/null || true)
  fi

  if [[ "${#FILES[@]}" -gt 0 ]]; then
    VIOLATIONS=$(
      grep -n "$PATTERN" "${FILES[@]}" 2>/dev/null \
      | grep -vE "$EXCLUDE" \
      | grep -v ':[[:space:]]*//' \
      || true
    )
  fi
else
  search_dirs=()
  for d in apps packages; do
    [[ -d "$d" ]] && search_dirs+=("$d")
  done

  if [[ "${#search_dirs[@]}" -gt 0 ]]; then
    VIOLATIONS=$(
      grep -rn "$PATTERN" "${search_dirs[@]}" \
        --include='*.test.ts' --include='*.test.tsx' 2>/dev/null \
      | grep -vE "$EXCLUDE" \
      | grep -v ':[[:space:]]*//' \
      || true
    )
  fi
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found direct db.<model>.create() calls in test files."
  echo "Use the factories from @template/db/test instead (author one if missing)."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No direct prisma creates found in test files."

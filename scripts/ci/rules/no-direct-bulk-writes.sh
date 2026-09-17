#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# Direct createMany / updateMany bypass the mutationLifeCycle extension (which throws on
# them), so per-row lifecycle hooks (webhooks, audit, observe) never fire for bulk writes.
# Source must use createManyAndReturn / updateManyAndReturn — the hook-firing bulk path.
#
# Exempt: the extension itself, the generated Prisma client, and test code — both
# *.test.ts and files under test dirs (e.g. packages/db/src/test/**), which may assert
# the guard throws.
EXCLUDE='AndReturn|/generated/|\.test\.ts|/tests?/|/__tests__/|extensions/mutationLifeCycle\.ts'

VIOLATIONS=""

# Real repo (has .git) = diff mode: only check *.ts files changed vs the base branch, so a
# pre-existing violation elsewhere in the tree never fails an unrelated PR. Fixture
# directory (no .git) = scan all *.ts under apps/ + packages/. `.git` is a dir in a normal
# checkout and a file in a worktree, so test for either (-e).
if [[ -e "$ROOT_DIR/.git" ]]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  MERGE_BASE=$(git merge-base "origin/${BASE_REF}" HEAD 2>/dev/null || true)

  FILES=()
  if [[ -n "$MERGE_BASE" ]]; then
    while IFS= read -r file; do
      [[ -f "$file" ]] || continue
      case "$file" in
        apps/*.ts | packages/*.ts) FILES+=("$file") ;;
      esac
    done < <(git diff --name-only --diff-filter=AM "$MERGE_BASE"...HEAD 2>/dev/null || true)
  fi

  if [[ "${#FILES[@]}" -gt 0 ]]; then
    VIOLATIONS=$(
      grep -En "\.(createMany|updateMany)\(" "${FILES[@]}" 2>/dev/null \
      | grep -vE "$EXCLUDE" \
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
      grep -rEn "\.(createMany|updateMany)\(" "${search_dirs[@]}" --include='*.ts' 2>/dev/null \
      | grep -vE "$EXCLUDE" \
      || true
    )
  fi
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found direct createMany/updateMany calls (these bypass mutationLifeCycle hooks):"
  echo "Use createManyAndReturn / updateManyAndReturn instead — the hook-firing bulk path."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No direct createMany/updateMany calls found."

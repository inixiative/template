#!/usr/bin/env bash
set -euo pipefail

# Resolve the detector path before cd — BASH_SOURCE is relative to the original cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR="$SCRIPT_DIR/lib/noSelectOnMutations.ts"

ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$ROOT_DIR"

# A Prisma write that passes select/omit returns a partial row. The after-write
# lifecycle hooks consume that row to detect changes and derive cache keys, so a
# narrowed result hides the changed column or strips the key-deriving field. Writes
# must return full rows; shape the result after the write instead. Reads
# (findMany/findFirst/…) are fine — the hazard is writes only.
#
# Detection is brace-aware (a literal grep can't tell a write's own top-level select
# from a nearby read's), so this wrapper selects the files and defers matching to
# scripts/ci/rules/lib/noSelectOnMutations.ts.
#
# Exempt: the generated Prisma client and test code — both *.test.ts and files under
# test dirs, which may assert the seam throws.
EXCLUDE='/generated/|\.test\.ts|/tests?/|/__tests__/'

# Real repo (has .git) = diff mode: only check *.ts files changed vs the base branch, so a
# pre-existing violation elsewhere never fails an unrelated PR. Fixture directory (no .git)
# = scan all *.ts under apps/ + packages/. `.git` is a dir in a normal checkout and a file
# in a worktree, so test for either (-e).
FILES=()
if [[ -e "$ROOT_DIR/.git" ]]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  MERGE_BASE=$(git merge-base "origin/${BASE_REF}" HEAD 2>/dev/null || true)

  if [[ -n "$MERGE_BASE" ]]; then
    while IFS= read -r file; do
      [[ -f "$file" ]] || continue
      case "$file" in
        apps/*.ts | packages/*.ts) FILES+=("$file") ;;
      esac
    done < <(git diff --name-only --diff-filter=AM "$MERGE_BASE"...HEAD 2>/dev/null || true)
  fi
else
  search_dirs=()
  for d in apps packages; do
    [[ -d "$d" ]] && search_dirs+=("$d")
  done

  if [[ "${#search_dirs[@]}" -gt 0 ]]; then
    while IFS= read -r file; do
      FILES+=("$file")
    done < <(find "${search_dirs[@]}" -type f -name '*.ts' | sort)
  fi
fi

# Drop exempt paths.
if [[ "${#FILES[@]}" -gt 0 ]]; then
  FILTERED=()
  for file in "${FILES[@]}"; do
    if ! grep -qE "$EXCLUDE" <<<"$file"; then
      FILTERED+=("$file")
    fi
  done
  FILES=("${FILTERED[@]}")
fi

if [[ "${#FILES[@]}" -eq 0 ]]; then
  echo "No select/omit on Prisma writes found."
  exit 0
fi

bun "$DETECTOR" "${FILES[@]}"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# A SELECT ... FOR UPDATE on a row that does not exist yet locks nothing, so find-then-create
# races, and the hand-rolled answers — a bare .upsert(, or catching the unique violation (P2002 /
# isUniqueConstraintError) and re-reading — each paper over it at one call site. The fence is
# db.findForUpdate(model, where, { upserting: true }), which locks the where-key itself.
#
# Ratchet, per file: a changed file fails only when it has MORE of these than it had at the merge
# base, so existing call sites never fail an unrelated PR and the count only goes down.
#
# Exempt: test code (hook tests exercise upsert on purpose), factories and seeds, the generated
# client, and the helper's own definition. Comment lines are not counted.
EXCLUDE='/generated/|\.test\.tsx?$|/tests?/|/__tests__/|/factories/|/prisma/seed|utils/isUniqueConstraintError\.ts$'
PATTERN='\.upsert\(|P2002|isUniqueConstraintError\('

count_matches() {
  grep -Ev '^[[:space:]]*(//|\*|/\*)' | grep -Ec "$PATTERN" || true
}

VIOLATIONS=""

add_violation() {
  VIOLATIONS+="$1"$'\n'
}

# Real repo (has .git) = ratchet vs the merge base. Fixture directory (no .git) = every match is
# a violation. `.git` is a dir in a normal checkout and a file in a worktree (-e).
if [[ -e "$ROOT_DIR/.git" ]]; then
  BASE_REF="${GITHUB_BASE_REF:-main}"
  MERGE_BASE=$(git merge-base "origin/${BASE_REF}" HEAD 2>/dev/null || true)

  if [[ -n "$MERGE_BASE" ]]; then
    while IFS= read -r file; do
      [[ -f "$file" ]] || continue
      case "$file" in
        apps/*.ts | apps/*.tsx | packages/*.ts | packages/*.tsx) ;;
        *) continue ;;
      esac
      if printf '%s\n' "$file" | grep -Eq "$EXCLUDE"; then continue; fi

      head_count=$(count_matches < "$file")
      base_count=0
      if git cat-file -e "$MERGE_BASE:$file" 2>/dev/null; then
        base_count=$(git show "$MERGE_BASE:$file" | count_matches)
      fi
      if (( head_count > base_count )); then
        add_violation "$file: $base_count -> $head_count"
      fi
    done < <(git diff --name-only --diff-filter=AM "$MERGE_BASE"...HEAD 2>/dev/null || true)
  fi
else
  search_dirs=()
  for d in apps packages; do
    [[ -d "$d" ]] && search_dirs+=("$d")
  done

  if [[ "${#search_dirs[@]}" -gt 0 ]]; then
    while IFS= read -r file; do
      if printf '%s\n' "$file" | grep -Eq "$EXCLUDE"; then continue; fi
      file_count=$(count_matches < "$file")
      if (( file_count > 0 )); then
        add_violation "$file: $file_count"
      fi
    done < <(find "${search_dirs[@]}" -type f \( -name '*.ts' -o -name '*.tsx' \) | sort)
  fi
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found new hand-rolled create-race handling (bare .upsert( or unique-violation catches):"
  echo "Fence the key instead: inside db.txn, call"
  echo "  db.findForUpdate(model, where, { upserting: true })"
  echo "then a plain find / create / update on what it returned."
  echo ""
  printf '%s' "$VIOLATIONS"
  exit 1
fi

echo "No new hand-rolled create-race handling found."

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# A rolling cache (makeRollingCache from @template/db) registers itself when its module loads, and
# the worker's coordinator refreshes every registered cache. A definition the worker never imports is
# never refreshed: every read past its first TTL is a cold recompute, silently. The worker imports
# every definition through one import-only barrel, so each file that calls makeRollingCache( must
# appear there as `import '<its module>';`.
#
# Full scan, not diff mode: the property is about the whole set of definitions, and a barrel edit
# can drop an entry without touching the definition.
#
# Exempt: the primitive itself, tests (they register and unregister their own caches), and
# comment lines.
BARREL='apps/api/src/lib/rollingCaches.ts'
PATTERN='makeRollingCache[[:space:]]*(<[^(]*>)?\('
EXCLUDE='packages/db/src/redis/makeRollingCache\.ts:|/generated/|/node_modules/|\.test\.ts:|/tests?/|/__tests__/'

search_dirs=()
for d in apps packages; do
  [[ -d "$d" ]] && search_dirs+=("$d")
done

if [[ "${#search_dirs[@]}" -eq 0 ]]; then
  echo "No source directories found to scan."
  exit 0
fi

DEFINITIONS=$(
  grep -rEn "$PATTERN" "${search_dirs[@]}" --include='*.ts' 2>/dev/null \
  | grep -vE "$EXCLUDE" \
  | grep -v "^${BARREL}:" \
  | awk -F: '{ content = ""; for(i=3;i<=NF;i++) content = content (i>3?":":"") $i; if (content !~ /^[[:space:]]*(\*|\/\/|\/\*)/) print $1 }' \
  | sort -u \
  || true
)

if [[ -z "$DEFINITIONS" ]]; then
  echo "No rolling cache definitions found."
  exit 0
fi

module_specifier() {
  local file="$1"
  local without_ext="${file%.ts}"
  case "$without_ext" in
    apps/api/src/*) printf '#/%s\n' "${without_ext#apps/api/src/}" ;;
    packages/*/src/*)
      local rest="${without_ext#packages/}"
      local pkg="${rest%%/*}"
      printf '@template/%s/%s\n' "$pkg" "${rest#*/src/}"
      ;;
    *) printf '\n' ;;
  esac
}

VIOLATIONS=""
while IFS= read -r file; do
  [[ -n "$file" ]] || continue
  spec="$(module_specifier "$file")"
  if [[ -z "$spec" ]]; then
    VIOLATIONS+="${file}: defines a rolling cache outside apps/api/src and packages/*/src, where the worker cannot import it"$'\n'
    continue
  fi
  if [[ ! -f "$BARREL" ]] || ! grep -qE "^import ['\"]${spec}['\"];?[[:space:]]*$" "$BARREL"; then
    VIOLATIONS+="${file}: missing \`import '${spec}';\` in ${BARREL}"$'\n'
  fi
done <<< "$DEFINITIONS"

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found rolling cache definitions the worker never imports, so they are never refreshed:"
  echo "Add each module to ${BARREL} as an import-only line."
  echo ""
  printf '%s' "$VIOLATIONS"
  exit 1
fi

echo "Every rolling cache definition is imported by ${BARREL}."

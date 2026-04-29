#!/usr/bin/env bash
# Detects and removes macOS Finder / iCloud conflict-resolution duplicates.
# These appear when a generator writes a file (or a tool replaces a directory)
# while iCloud / Dropbox / Finder is mid-sync — the system creates a sibling
# with " N" appended to the basename, e.g. "routeTree.gen 2.ts" or
# "node_modules 2/".
#
# Files: scoped to *generated* artifacts only — relies on two stable
# project conventions so new generators inherit automatically without
# editing this script:
#   1. Canonical basename matches *.gen.* (TanStack Router, Vite plugin,
#      OpenAPI SDK, prisma-zod, …), OR
#   2. Path contains a /generated/ segment (Prisma client + zod schemas)
#   AND the canonical sibling exists in the same directory.
#
# Directories: root-level only, allowlisted to known-safe nuke targets
# (node_modules, .turbo, .next, .vercel, dist, build).
#
# Pass --check to fail without deleting (CI mode).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mode="clean"
if [[ "${1:-}" == "--check" ]]; then
  mode="check"
fi

# ---- File duplicates ---------------------------------------------------------

# Search broadly but skip obvious noise paths. The canonical-sibling +
# generated-name filter below is the real guard.
file_candidates=$(
  find . \
    -type f \
    \( -name "* [0-9].*" -o -name "* [0-9][0-9].*" \) \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" \
    -not -path "./.git/*" \
    -not -path "./.turbo/*" \
    -not -path "./.vercel/*" \
    -not -path "./.next/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "./tmp/*" \
    2>/dev/null || true
)

file_dupes=""
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  canonical_base="$(echo "$base" | sed -E 's/ [0-9]+(\.[^.]*)$/\1/')"

  is_generated=false
  case "$canonical_base" in
    *.gen.*) is_generated=true ;;
  esac
  case "$f" in
    */generated/*) is_generated=true ;;
  esac
  [[ "$is_generated" == true ]] || continue

  if [[ -f "$dir/$canonical_base" ]]; then
    file_dupes+="$f"$'\n'
  fi
done <<< "$file_candidates"

file_dupes="${file_dupes%$'\n'}"

# ---- Directory duplicates (root-level only, allowlisted) ---------------------

DIR_ALLOWLIST=(node_modules .turbo .next .vercel dist build)

dir_dupes=""
shopt -s nullglob
for d in *\ [0-9] *\ [0-9][0-9]; do
  [[ -d "$d" ]] || continue
  canonical_d="$(echo "$d" | sed -E 's/ [0-9]+$//')"
  [[ -d "$canonical_d" ]] || continue
  for allowed in "${DIR_ALLOWLIST[@]}"; do
    if [[ "$canonical_d" == "$allowed" ]]; then
      dir_dupes+="$d"$'\n'
      break
    fi
  done
done
shopt -u nullglob

dir_dupes="${dir_dupes%$'\n'}"

# ---- Report / act ------------------------------------------------------------

if [[ -z "$file_dupes" && -z "$dir_dupes" ]]; then
  exit 0
fi

file_count=0
dir_count=0
[[ -n "$file_dupes" ]] && file_count=$(printf '%s\n' "$file_dupes" | wc -l | tr -d ' ')
[[ -n "$dir_dupes" ]] && dir_count=$(printf '%s\n' "$dir_dupes" | wc -l | tr -d ' ')

if [[ "$mode" == "check" ]]; then
  if [[ "$file_count" -gt 0 ]]; then
    echo "Found $file_count Finder duplicate file(s) of generated artifacts:"
    printf '%s\n' "$file_dupes" | sed 's/^/  /'
  fi
  if [[ "$dir_count" -gt 0 ]]; then
    echo "Found $dir_count Finder duplicate director(y/ies) at repo root:"
    printf '%s\n' "$dir_dupes" | sed 's/^/  /'
  fi
  echo
  echo "Run 'bash scripts/lint/check-finder-duplicates.sh' to remove them."
  echo "To prevent recurrence, disable iCloud sync for ~/Desktop or move the project out of ~/Desktop."
  exit 1
fi

if [[ "$file_count" -gt 0 ]]; then
  echo "Removing $file_count Finder duplicate file(s):"
  printf '%s\n' "$file_dupes" | while IFS= read -r f; do
    echo "  $f"
    rm -- "$f"
  done
fi

if [[ "$dir_count" -gt 0 ]]; then
  echo "Removing $dir_count Finder duplicate director(y/ies):"
  printf '%s\n' "$dir_dupes" | while IFS= read -r d; do
    echo "  $d"
    rm -rf -- "$d"
  done
fi

#!/usr/bin/env bash
# Detects and removes macOS Finder / iCloud conflict-resolution duplicates
# (filenames like "foo 2.ts", "routeTree.gen 3.json"). These appear when a
# generator writes a file while iCloud / Dropbox / Finder is mid-sync.
#
# They are gitignored, but can still confuse build tooling, knip, and
# bundlers. Pass --check to fail without deleting (CI mode).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

mode="clean"
if [[ "${1:-}" == "--check" ]]; then
  mode="check"
fi

dupes=$(
  find . \
    -type f \
    \( -name "* [0-9].*" -o -name "* [0-9][0-9].*" \) \
    -not -path "./node_modules/*" \
    -not -path "*/node_modules/*" \
    -not -path "./.git/*" \
    -not -path "./.turbo/*" \
    -not -path "./.vercel/*" \
    -not -path "./.next/*" \
    -not -path "./tmp/*"
)

if [[ -z "$dupes" ]]; then
  exit 0
fi

count=$(printf '%s\n' "$dupes" | wc -l | tr -d ' ')

if [[ "$mode" == "check" ]]; then
  echo "Found $count macOS / iCloud duplicate file(s) (likely from Desktop iCloud sync):"
  printf '%s\n' "$dupes" | sed 's/^/  /'
  echo
  echo "Run 'bash scripts/lint/check-finder-duplicates.sh' to remove them."
  echo "To prevent recurrence, disable iCloud sync for ~/Desktop or move the project out of ~/Desktop."
  exit 1
fi

echo "Removing $count macOS / iCloud duplicate file(s):"
printf '%s\n' "$dupes" | while IFS= read -r f; do
  echo "  $f"
  rm -- "$f"
done

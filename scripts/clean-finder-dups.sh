#!/usr/bin/env bash
# Removes macOS Finder duplicates left behind by accidental cmd-D / drag-copy.
# Pattern: trailing space + digit (2-9) before the extension — "foo 2.ts", "bar 3.json",
# "baz 4" (dir). Skips node_modules and .git. Tracked files never match this pattern
# in repo conventions; the find is safe.
set -euo pipefail

ROOT="${1:-.}"

files=$(find "$ROOT" -name '* [2-9].*' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | wc -l | tr -d ' ')
dirs=$(find "$ROOT" -depth -type d -name '* [2-9]' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | wc -l | tr -d ' ')

if [ "$files" = "0" ] && [ "$dirs" = "0" ]; then
  echo "No Finder duplicates found in $ROOT"
  exit 0
fi

echo "Removing $files file(s) + $dirs dir(s) matching '* [2-9]*' in $ROOT..."
find "$ROOT" -name '* [2-9].*' -not -path '*/node_modules/*' -not -path '*/.git/*' -delete
find "$ROOT" -depth -type d -name '* [2-9]' -not -path '*/node_modules/*' -not -path '*/.git/*' -exec rm -rf {} +
echo "Done."

#!/usr/bin/env bash
set -euo pipefail

if [ -n "$(git status --porcelain)" ]; then
  echo "cleanup-scan:record: commit or discard your changes first; the scan records the commit the check ran on" >&2
  exit 1
fi

scanned=$(git rev-parse HEAD)
bun run check

if [ "$(git rev-parse HEAD)" != "$scanned" ] || [ -n "$(git status --porcelain)" ]; then
  echo "cleanup-scan:record: the checkout changed while the check ran; run it again" >&2
  exit 1
fi

echo "$scanned" > "$(git rev-parse --git-path cleanup-scan)"
echo "cleanup-scan:record: recorded the scan of $scanned"

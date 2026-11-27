#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

force_full=0
for arg in "$@"; do
  case "$arg" in
    --full) force_full=1 ;;
    *)
      echo "cleanup-scan:record: unknown argument '$arg' (supported: --full)" >&2
      exit 2
      ;;
  esac
done

if [ -n "$(git status --porcelain)" ]; then
  echo "cleanup-scan:record: commit or discard your changes first; the scan records the commit the check ran on" >&2
  exit 1
fi

scanned=$(git rev-parse HEAD)

determine_scope() {
  if [ "$force_full" -eq 1 ]; then
    echo "full"
    return
  fi

  local base=""
  if git rev-parse --verify origin/main >/dev/null 2>&1; then
    base=$(git merge-base origin/main HEAD 2>/dev/null || true)
  fi
  if [ -z "$base" ]; then
    echo "full"
    return
  fi

  local changed
  changed=$(git diff --no-renames --name-only "$base"..HEAD)
  if [ -z "$changed" ]; then
    echo "full"
    return
  fi

  local all_docs=1
  local all_frontend=1
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    case "$file" in
      *.md)
        ;;
      packages/ui/scripts/*)
        all_docs=0
        all_frontend=0
        break
        ;;
      apps/web/*|apps/admin/*|apps/superadmin/*|packages/ui/*|tests/frontend/*)
        all_docs=0
        ;;
      *)
        all_docs=0
        all_frontend=0
        break
        ;;
    esac
  done <<< "$changed"

  if [ "$all_docs" -eq 1 ]; then
    echo "docs"
  elif [ "$all_frontend" -eq 1 ]; then
    echo "frontend"
  else
    echo "full"
  fi
}

scope=$(determine_scope)
echo "cleanup-scan:record: scope=${scope} for ${scanned:0:9}"

case "$scope" in
  docs)
    bun run lint
    bash scripts/ci/run-ci-rules.sh
    ;;
  frontend)
    bun run check:fe
    ;;
  full)
    bun run check
    ;;
esac

if [ "$(git rev-parse HEAD)" != "$scanned" ] || [ -n "$(git status --porcelain)" ]; then
  echo "cleanup-scan:record: the checkout changed while the check ran; run it again" >&2
  exit 1
fi

echo "$scanned" > "$(git rev-parse --git-path cleanup-scan)"
echo "cleanup-scan:record: recorded the scan of $scanned (scope=${scope})"

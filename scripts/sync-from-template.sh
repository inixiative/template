#!/usr/bin/env bash
# Pull commits from the upstream template repo into this fork.
#
# Why this script: when you bootstrap from inixiative/template, package
# imports are renamed from @template/* to @<your-project>/* by init. After
# that, raw git cherry-pick / merge from template breaks on import paths.
# This script applies template commits with the import-prefix rewrite
# baked in, so syncing stays cheap.
#
# IMPORTANT: this file is intentionally excluded from init's
# @template→@<your-project> renamer (see init/tasks/projectConfig.ts).
# The @template/ references below are real — they refer to the upstream
# repo's package prefix and must stay literal regardless of which fork
# this script lives in.
#
# Usage:
#   ./scripts/sync-from-template.sh                    # template/main → current branch
#   ./scripts/sync-from-template.sh <branch>           # template/<branch> → current branch
#   ./scripts/sync-from-template.sh <sha>              # up to <sha>
#   ./scripts/sync-from-template.sh <since>..<until>   # explicit range
#
# First-time use: write a baseline template SHA into .template-sync, e.g.
#   git rev-parse template/main~50 > .template-sync
# (the SHA your fork was originally bootstrapped from). Subsequent runs
# update this file automatically.

set -euo pipefail

TEMPLATE_REMOTE="${TEMPLATE_REMOTE:-https://github.com/inixiative/template.git}"
SYNC_MARKER=".template-sync"

# Upstream package prefix to rewrite. Constructed at runtime via printf so the
# literal "@template/" never appears in this file — that means a sed pipeline
# rewriting "@template/" → something else (this script's own pipeline, or a
# manual one-shot port between repos) won't accidentally mangle the script.
UPSTREAM_PREFIX="$(printf '@%s/' template)"

# Local prefix from this repo's root package.json (e.g. "monorepo" → @monorepo/*)
LOCAL_PREFIX="$(node -p "require('./package.json').name" 2>/dev/null || true)"
if [ -z "$LOCAL_PREFIX" ]; then
  echo "error: could not read package.json:name — run from repo root" >&2
  exit 1
fi

# Add 'template' remote if missing
if ! git remote get-url template >/dev/null 2>&1; then
  echo "adding 'template' remote → $TEMPLATE_REMOTE"
  git remote add template "$TEMPLATE_REMOTE"
fi

git fetch template >&2

ARG="${1:-main}"

# Resolve the range
case "$ARG" in
  *..*)
    RANGE="$ARG"
    ;;
  *)
    if [ ! -f "$SYNC_MARKER" ]; then
      echo "error: $SYNC_MARKER missing." >&2
      echo "  First-time setup: write the baseline template SHA your fork was bootstrapped from:" >&2
      echo "    git rev-parse template/main~N > $SYNC_MARKER" >&2
      echo "  Or pass an explicit range: ./scripts/sync-from-template.sh <since>..<until>" >&2
      exit 1
    fi
    SINCE="$(cat "$SYNC_MARKER")"
    if git rev-parse --verify --quiet "template/$ARG" >/dev/null; then
      UNTIL="template/$ARG"
    else
      UNTIL="$ARG"
    fi
    RANGE="$SINCE..$UNTIL"
    ;;
esac

NEW_TIP="$(git rev-parse "${RANGE##*..}")"

# No-op if nothing to apply
COUNT="$(git rev-list --count "$RANGE")"
if [ "$COUNT" = "0" ]; then
  echo "already in sync — no commits in $RANGE"
  exit 0
fi

echo "porting $COUNT commit(s) from $RANGE"
echo "rewriting ${UPSTREAM_PREFIX} → @${LOCAL_PREFIX}/"

set +e
git format-patch "$RANGE" --stdout \
  | sed -E "s|${UPSTREAM_PREFIX}|@${LOCAL_PREFIX}/|g" \
  | git am -3 --keep-cr
AM_STATUS=$?
set -e

if [ "$AM_STATUS" -ne 0 ]; then
  cat >&2 <<'EOF'

git am failed — resolve conflicts manually, then:
  git add <resolved files>
  git am --continue
or to abandon: git am --abort

The .template-sync marker has NOT been bumped — fix conflicts first,
then re-run this script (or set the marker by hand once resolved).
EOF
  exit "$AM_STATUS"
fi

echo "$NEW_TIP" > "$SYNC_MARKER"
git add "$SYNC_MARKER"
git commit -m "chore: bump $SYNC_MARKER to $NEW_TIP"

echo
echo "✓ synced through $NEW_TIP"
echo "  remember to run \`bun install\` if any package.json changed"

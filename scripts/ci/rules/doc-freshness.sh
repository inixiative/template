#!/usr/bin/env bash
set -euo pipefail

# Resolve the detector path before cd — BASH_SOURCE is relative to the original cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DETECTOR="$SCRIPT_DIR/lib/docFreshness.ts"

ROOT_DIR="${1:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
cd "$ROOT_DIR"

# Doc rot is the repo's job. The agent docs (docs/claude/**, AI/ENTRYPOINT.md, FEATURES.md,
# apps/*/CLAUDE.md) steer every change, so a doc that names a path, line or symbol the code no
# longer has sends the next reader to something that isn't there.
#
# FAIL: a backticked or linked repo path that doesn't exist, a `path:line` / `path#La-Lb` past
# the file's end, a `doc.md#heading` with no such heading, or a backticked camelCase/PascalCase
# name that appears nowhere in the code. Fenced code and sections headed "Under construction" /
# "Migrations in progress" are skipped.
# Full scan, not diff mode: code changes break docs nobody touched.
#
# External or illustrative names: scripts/ci/doc-freshness/allow.txt. Stale references from
# before the rule: scripts/ci/doc-freshness/baseline.txt (reported, not failed; an entry that no
# longer occurs fails, so the list only shrinks).
#
# WARN only: the branch changes code whose @atlas @partOf concept has docs in
# .atlas/concepts.ts, and touches none of them.
bun "$DETECTOR" "--base=${GITHUB_BASE_REF:-main}"

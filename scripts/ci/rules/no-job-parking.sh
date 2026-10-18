#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# Collision policy for jobs is binary: a singleton skips the new run, superseding takes over.
# Nothing parks. "Parking" a job (moveToDelayed + DelayedError, so it comes back in a moment and
# tries again) is how a lock quietly turns a plain job into a serialized one: every run queues behind
# the slowest, the worker churns, and a hung holder parks the rest forever.
#
# The one sanctioned use is the slow-lane capacity gate (claimSlotOrRequeue.ts): a slow job that
# finds no slow slot waits for capacity. That is admission control, not collision handling.
#
# Matches the act of parking (calling moveToDelayed, throwing a new DelayedError), not code that
# merely recognizes BullMQ's wait signals.
#
# Exempt: that file, the generated client, and tests.
search_dirs=()
for d in apps packages; do
  [[ -d "$d" ]] && search_dirs+=("$d")
done

VIOLATIONS=""
if [[ "${#search_dirs[@]}" -gt 0 ]]; then
  VIOLATIONS=$(
    grep -rEn "moveToDelayed\(|new DelayedError" "${search_dirs[@]}" --include='*.ts' 2>/dev/null \
    | grep -vE "/generated/|/node_modules/|apps/api/src/jobs/claimSlotOrRequeue\.ts:|\.test\.ts:|/tests?/|/__tests__/" \
    | awk -F: '{ content = ""; for(i=3;i<=NF;i++) content = content (i>3?":":"") $i; if (content !~ /^[[:space:]]*(\*|\/\/|\/\*)/) print }' \
    || true
  )
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found job parking (moveToDelayed / throw new DelayedError outside the slow-lane capacity gate):"
  echo "Jobs don't park. A singleton skips a busy key; superseding takes over. If every run must"
  echo "happen, it's a plain job, and contention at the receiver is retried, not serialized."
  echo "See docs/claude/JOBS.md (Handler Patterns)."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No job parking found."

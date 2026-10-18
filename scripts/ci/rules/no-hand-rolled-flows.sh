#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
cd "$ROOT_DIR"

# A job that fans out and waits for its pieces is a staged job: the constructor takes
# { stages, finish }, each stage adds children with ctx.enqueueChildJob, and runJobStages parks the
# job in waiting-children until they report. The primitive owns the BullMQ flow machinery
# (moveToWaitingChildren, WaitingChildrenError, the parent link, ignoreDependencyOnFailure). A second
# copy of it is how a pending hash, a polling loop or a "refire whatever is still pending" creeps
# back in, and a child added from outside a stage breaks "only a job can have children".
#
# Exempt: the primitive (runJobStages.ts, makeEnqueueChildJob.ts, parkOnUnfinishedChildren.ts),
# types.ts (the option's type), traceJob.ts (keeps BullMQ's wait signals, a parked parent included,
# out of the job span's error status), makeSupersedingJob.ts (a parked superseding job holds its
# lane), apps/api/scripts (checks that drive real BullMQ), the generated client and tests.
search_dirs=()
for d in apps packages; do
  [[ -d "$d" ]] && search_dirs+=("$d")
done

VIOLATIONS=""
if [[ "${#search_dirs[@]}" -gt 0 ]]; then
  VIOLATIONS=$(
    grep -rEn "moveToWaitingChildren|WaitingChildrenError|FlowProducer|ignoreDependencyOnFailure|failParentOnFailure|removeDependencyOnFailure" "${search_dirs[@]}" --include='*.ts' 2>/dev/null \
    | grep -vE "/generated/|/node_modules/|apps/api/src/jobs/runJobStages\.ts:|apps/api/src/jobs/makeEnqueueChildJob\.ts:|apps/api/src/jobs/parkOnUnfinishedChildren\.ts:|apps/api/src/jobs/types\.ts:|apps/api/src/jobs/traceJob\.ts:|apps/api/src/jobs/makeSupersedingJob\.ts:|apps/api/scripts/|\.test\.ts:|/tests?/|/__tests__/" \
    | awk -F: '{ content = ""; for(i=3;i<=NF;i++) content = content (i>3?":":"") $i; if (content !~ /^[[:space:]]*(\*|\/\/|\/\*)/) print }' \
    || true
  )
fi

if [[ -n "$VIOLATIONS" ]]; then
  echo "Found BullMQ flow machinery outside runJobStages:"
  echo "Fan out and wait with a staged job: pass { stages, finish } to makeJob / makeSingletonJob /"
  echo "makeSupersedingJob and add children with ctx.enqueueChildJob inside a stage."
  echo "See docs/claude/JOBS.md (Staged Job)."
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "No hand-rolled flows found."

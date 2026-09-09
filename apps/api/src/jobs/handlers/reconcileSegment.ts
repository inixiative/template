/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { SegmentRuleEvaluationError } from '#/modules/segment/services/evaluateSegment';
import { publishMembershipChange } from '#/modules/segment/services/publishMembershipChange';
import { dynamicSegmentsOf } from '#/modules/segment/services/reconcileCustomerRef';
import { isReconcilable, reconcileSegment as reconcile } from '#/modules/segment/services/reconcileSegment';
import { clearEvaluationPause, pauseForEvaluationError } from '#/modules/segment/services/segmentReconcilePause';
import { buildReferenceMap, referencedBy } from '#/modules/segment/services/segmentReferenceGraph';

export type ReconcileSegmentPayload = {
  segmentId: string;
  referencePath?: string[];
};

const isFinalAttempt = (job: { attemptsMade?: number; opts?: { attempts?: number } }): boolean =>
  (job.attemptsMade ?? 0) + 1 >= (job.opts?.attempts ?? 1);

export const reconcileSegment = makeSupersedingJob<ReconcileSegmentPayload>(
  async (ctx, payload) => {
    const { segmentId, referencePath = [] } = payload;
    const segment = await db.segment.findUnique({ where: { id: segmentId } });
    if (!segment || !isReconcilable(segment)) return;

    let diff: Awaited<ReturnType<typeof reconcile>>;
    try {
      diff = await reconcile(segment, db, ctx.signal);
    } catch (error) {
      if (!(error instanceof SegmentRuleEvaluationError)) throw error;
      if (!isFinalAttempt(ctx.job)) throw error;
      await pauseForEvaluationError(segmentId, error, db);
      return;
    }
    await clearEvaluationPause(segmentId, db);

    if (!diff.added.length && !diff.removed.length) return;
    await publishMembershipChange(segment, diff, db);

    const path = [...referencePath, segmentId];
    const siblings = await dynamicSegmentsOf(segment.ownerModel, segmentOwnerId(segment), db);
    const dependents = referencedBy(buildReferenceMap(siblings), segmentId).filter((id) => !path.includes(id));
    for (const dependentId of dependents) {
      await enqueueJob('reconcileSegment', { segmentId: dependentId, referencePath: path });
    }
  },
  (payload) => `segment:${payload.segmentId}`,
);

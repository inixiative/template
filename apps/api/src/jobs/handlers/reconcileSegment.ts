/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { RuleDegradedError } from '@template/shared/rules';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { publishMembershipChanges } from '#/modules/segment/services/publishMembershipChanges';
import { dynamicSegmentsOf } from '#/modules/segment/services/reconcileCustomerRef';
import { isReconcilable, reconcileSegment as reconcile } from '#/modules/segment/services/reconcileSegment';
import { buildReferenceMap, referencedBy } from '#/modules/segment/services/segmentReferenceGraph';
import { soundSegments } from '#/modules/segment/services/withSegmentRuleIssues';

export type ReconcileSegmentPayload = {
  segmentId: string;
  referencePath?: string[];
};

export const reconcileSegment = makeSupersedingJob<ReconcileSegmentPayload>(
  async (ctx, payload) => {
    const { segmentId, referencePath = [] } = payload;
    const segment = await db.segment.findUnique({ where: { id: segmentId } });
    if (!segment || !isReconcilable(segment)) return;

    let diff: Awaited<ReturnType<typeof reconcile>>;
    try {
      diff = await reconcile(segment, ctx.signal);
    } catch (error) {
      if (!(error instanceof RuleDegradedError)) throw error;
      log.warn(`reconcileSegment: ${error.message}`);
      return;
    }

    if (!diff.added.length && !diff.removed.length) return;
    await publishMembershipChanges([{ segment, diff }]);

    const path = [...referencePath, segmentId];
    const siblings = await soundSegments(await dynamicSegmentsOf(segment.ownerModel, segmentOwnerId(segment)));
    const dependents = referencedBy(buildReferenceMap(siblings), segmentId).filter((id) => !path.includes(id));
    for (const dependentId of dependents) {
      await enqueueJob('reconcileSegment', { segmentId: dependentId, referencePath: path });
    }
  },
  (payload) => `segment:${payload.segmentId}`,
);

/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { publishMembershipChange } from '#/modules/segment/services/publishMembershipChange';
import { reconcileCustomerRef } from '#/modules/segment/services/reconcileCustomerRef';

export type ReconcileCustomerRefSegmentsPayload = {
  customerRefId: string;
};

export const reconcileCustomerRefSegments = makeSupersedingJob<ReconcileCustomerRefSegmentsPayload>(
  async (_ctx, payload) => {
    const changes = await reconcileCustomerRef(payload.customerRefId, db);
    for (const { segmentId, diff } of changes) {
      const segment = await db.segment.findUnique({ where: { id: segmentId } });
      if (segment) await publishMembershipChange(segment, diff, db);
    }
  },
  (payload) => `customerRef:${payload.customerRefId}`,
);

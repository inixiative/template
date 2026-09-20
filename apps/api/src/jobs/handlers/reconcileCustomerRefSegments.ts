/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { customerRefCustomerFk } from '#/modules/segment/lib/segmentOwner';
import { type MembershipChange, publishMembershipChanges } from '#/modules/segment/services/publishMembershipChanges';
import { reconcileCustomerRef } from '#/modules/segment/services/reconcileCustomerRef';

export type ReconcileCustomerRefSegmentsPayload = { customerModel: CustomerModel; customerId: string };

export const reconcileCustomerRefSegments = makeSupersedingJob<ReconcileCustomerRefSegmentsPayload>(
  async (_ctx, { customerModel, customerId }) => {
    const refs = await db.customerRef.findMany({
      where: { customerModel, [customerRefCustomerFk(customerModel)]: customerId },
    });
    const changes: MembershipChange[] = [];
    for (const ref of refs) {
      for (const { segmentId, diff } of await reconcileCustomerRef(ref.id, db)) {
        const segment = await db.segment.findUnique({ where: { id: segmentId } });
        if (segment) changes.push({ segment, diff });
      }
    }
    await publishMembershipChanges(changes, db);
  },
  ({ customerModel, customerId }) => `customer:${customerModel}:${customerId}`,
);

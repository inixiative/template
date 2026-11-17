/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { customerRelationshipCustomerFk } from '#/modules/segment/lib/segmentOwner';
import {
  type MembershipChange,
  publishMembershipChanges,
} from '#/modules/segment/services/publishMembershipChanges';
import { reconcileCustomerRelationship } from '#/modules/segment/services/reconcileCustomerRelationship';

export type ReconcileCustomerRelationshipSegmentsPayload = {
  customerModel: CustomerModel;
  customerId: string;
};

export const reconcileCustomerRelationshipSegments =
  makeSupersedingJob<ReconcileCustomerRelationshipSegmentsPayload>(
    async (_ctx, { customerModel, customerId }) => {
      const refs = await db.customerRelationship.findMany({
        where: { customerModel, [customerRelationshipCustomerFk(customerModel)]: customerId },
      });
      const changes: MembershipChange[] = [];
      for (const ref of refs) {
        for (const { segmentId, diff } of await reconcileCustomerRelationship(ref.id)) {
          const segment = await db.segment.findUnique({ where: { id: segmentId } });
          if (segment) changes.push({ segment, diff });
        }
      }
      await publishMembershipChanges(changes);
    },
    ({ customerModel, customerId }) => `customer:${customerModel}:${customerId}`,
  );

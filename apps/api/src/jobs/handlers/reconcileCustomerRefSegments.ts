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

export type ReconcileCustomerRefSegmentsPayload =
  | { customerRefId: string }
  | { customerModel: CustomerModel; customerId: string };

const customerRefIds = async (payload: ReconcileCustomerRefSegmentsPayload): Promise<string[]> => {
  if ('customerRefId' in payload) return [payload.customerRefId];
  const fk = customerRefCustomerFk(payload.customerModel);
  if (!fk) return [];
  const refs = await db.customerRef.findMany({ where: { [fk]: payload.customerId } });
  return refs.map((ref) => ref.id);
};

export const reconcileCustomerRefSegments = makeSupersedingJob<ReconcileCustomerRefSegmentsPayload>(
  async (_ctx, payload) => {
    const changes: MembershipChange[] = [];
    for (const customerRefId of await customerRefIds(payload)) {
      for (const { segmentId, diff } of await reconcileCustomerRef(customerRefId, db)) {
        const segment = await db.segment.findUnique({ where: { id: segmentId } });
        if (segment) changes.push({ segment, diff });
      }
    }
    await publishMembershipChanges(changes, db);
  },
  (payload) =>
    'customerRefId' in payload
      ? `customerRef:${payload.customerRefId}`
      : `customer:${payload.customerModel}:${payload.customerId}`,
);

/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db } from '@template/db';
import type { CustomerModel } from '@template/db/generated/client/enums';
import { groupBy } from 'lodash-es';
import { makeJob } from '#/jobs/makeJob';
import type { CustomerReference } from '#/modules/customerRelationship/lib/customerReference';
import { customerRelationshipCustomerFk } from '#/modules/segment/lib/segmentOwner';
import {
  type MembershipChange,
  publishMembershipChanges,
} from '#/modules/segment/services/publishMembershipChanges';
import { reconcileCustomerRelationships } from '#/modules/segment/services/reconcileCustomerRelationships';

export type ReconcileCustomerRelationshipSegmentsPayload = { customers: CustomerReference[] };

const fetchCustomerRelationshipsOfCustomers = (customers: CustomerReference[]) =>
  db.customerRelationship.findMany({
    where: {
      OR: Object.entries(groupBy(customers, 'customerModel')).map(([customerModel, group]) => ({
        customerModel: customerModel as CustomerModel,
        [customerRelationshipCustomerFk(customerModel as CustomerModel)]: {
          in: group.map(({ customerId }) => customerId),
        },
      })),
    },
  });

const changesOnLiveSegments = async (changes: MembershipChange[]): Promise<MembershipChange[]> => {
  const live = new Map(
    (
      await db.segment.findMany({ where: { id: { in: changes.map(({ segment }) => segment.id) } } })
    ).map((segment) => [segment.id, segment]),
  );
  return changes.flatMap(({ segment, diff }) => {
    const current = live.get(segment.id);
    return current ? [{ segment: current, diff }] : [];
  });
};

export const reconcileCustomerRelationshipSegments =
  makeJob<ReconcileCustomerRelationshipSegmentsPayload>(async (_ctx, { customers }) => {
    if (!customers.length) return;
    const changes = await reconcileCustomerRelationships(
      await fetchCustomerRelationshipsOfCustomers(customers),
    );
    if (!changes.length) return;
    await publishMembershipChanges(await changesOnLiveSegments(changes));
  });

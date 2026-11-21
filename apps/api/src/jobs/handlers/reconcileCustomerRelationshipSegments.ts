/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:segment, primitive:appEvents
 */
import { db, wherePolymorphicSideIsOneOf } from '@template/db';
import { makeJob } from '#/jobs/makeJob';
import type { CustomerSide } from '#/modules/customerRelationship/lib/customerRelationshipSides';
import {
  type MembershipChange,
  publishMembershipChanges,
} from '#/modules/segment/services/publishMembershipChanges';
import { reconcileCustomerRelationships } from '#/modules/segment/services/reconcileCustomerRelationships';

export type ReconcileCustomerRelationshipSegmentsPayload = { customers: CustomerSide[] };

const fetchCustomerRelationshipsOfCustomers = (customers: CustomerSide[]) =>
  db.customerRelationship.findMany({
    where: wherePolymorphicSideIsOneOf(
      'CustomerRelationship',
      'customerModel',
      customers.map(({ customerModel, customerId }) => ({ model: customerModel, id: customerId })),
    ),
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

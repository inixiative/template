/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses primitive:appEvents, infrastructure:prisma
 */
import { db, polymorphicTarget } from '@template/db';
import type { CustomerRelationship, Segment } from '@template/db/generated/client/client';
import { emitAppEvent } from '#/appEvents/emit';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import type { MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';

export type MembershipChange = { segment: Segment; diff: MembershipDiff };

type PerCustomerRelationship = { added: string[]; removed: string[] };

export const customerRelationshipCustomerId = (
  customerRelationship: CustomerRelationship,
): string => polymorphicTarget(customerRelationship, 'CustomerRelationship', 'customerModel')!.id;

const bySegment = async ({ segment, diff }: MembershipChange): Promise<void> => {
  const subject = {
    segmentId: segment.id,
    ownerModel: segment.ownerModel,
    ownerId: segmentOwnerId(segment),
  };
  if (diff.added.length)
    await emitAppEvent('segment.membersAdded', { ...subject, customerRelationshipIds: diff.added });
  if (diff.removed.length)
    await emitAppEvent('segment.membersRemoved', {
      ...subject,
      customerRelationshipIds: diff.removed,
    });
};

const byCustomerRelationship = (
  changes: MembershipChange[],
): Map<string, PerCustomerRelationship> => {
  const out = new Map<string, PerCustomerRelationship>();
  const entry = (id: string) => out.get(id) ?? out.set(id, { added: [], removed: [] }).get(id)!;
  for (const { segment, diff } of changes) {
    for (const id of diff.added) entry(id).added.push(segment.id);
    for (const id of diff.removed) entry(id).removed.push(segment.id);
  }
  return out;
};

export const publishMembershipChanges = async (changes: MembershipChange[]): Promise<void> => {
  const moved = changes.filter(({ diff }) => diff.added.length || diff.removed.length);
  if (!moved.length) return;

  for (const change of moved) await bySegment(change);

  const changesByCustomerRelationship = byCustomerRelationship(moved);
  const customerRelationships = await db.customerRelationship.findMany({
    where: { id: { in: [...changesByCustomerRelationship.keys()] } },
  });
  for (const customerRelationship of customerRelationships) {
    const { added, removed } = changesByCustomerRelationship.get(customerRelationship.id)!;
    const subject = {
      customerRelationshipId: customerRelationship.id,
      customerModel: customerRelationship.customerModel,
      customerId: customerRelationshipCustomerId(customerRelationship),
    };
    if (added.length)
      await emitAppEvent('customerRelationship.segmentsAdded', { ...subject, segmentIds: added });
    if (removed.length)
      await emitAppEvent('customerRelationship.segmentsRemoved', {
        ...subject,
        segmentIds: removed,
      });
  }
};

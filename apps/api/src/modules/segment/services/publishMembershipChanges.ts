/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses primitive:appEvents, infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
import type { CustomerRef, Segment } from '@template/db/generated/client/client';
import { emitAppEvent } from '#/appEvents/emit';
import { customerRefCustomerFk, segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import type { MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';

export type MembershipChange = { segment: Segment; diff: MembershipDiff };

type PerCustomerRef = { added: string[]; removed: string[] };

export const customerRefCustomerId = (customerRef: CustomerRef): string =>
  (customerRef as unknown as Record<string, string>)[customerRefCustomerFk(customerRef.customerModel)!]!;

const bySegment = async ({ segment, diff }: MembershipChange): Promise<void> => {
  const subject = { segmentId: segment.id, ownerModel: segment.ownerModel, ownerId: segmentOwnerId(segment) };
  if (diff.added.length) await emitAppEvent('segment.membersAdded', { ...subject, customerRefIds: diff.added });
  if (diff.removed.length) await emitAppEvent('segment.membersRemoved', { ...subject, customerRefIds: diff.removed });
};

const byCustomerRef = (changes: MembershipChange[]): Map<string, PerCustomerRef> => {
  const out = new Map<string, PerCustomerRef>();
  const entry = (id: string) => out.get(id) ?? out.set(id, { added: [], removed: [] }).get(id)!;
  for (const { segment, diff } of changes) {
    for (const id of diff.added) entry(id).added.push(segment.id);
    for (const id of diff.removed) entry(id).removed.push(segment.id);
  }
  return out;
};

export const publishMembershipChanges = async (changes: MembershipChange[], db: Db = defaultDb): Promise<void> => {
  const moved = changes.filter(({ diff }) => diff.added.length || diff.removed.length);
  if (!moved.length) return;

  for (const change of moved) await bySegment(change);

  const perRef = byCustomerRef(moved);
  const refs = await db.customerRef.findMany({ where: { id: { in: [...perRef.keys()] } } });
  for (const customerRef of refs) {
    const { added, removed } = perRef.get(customerRef.id)!;
    const subject = {
      customerRefId: customerRef.id,
      customerModel: customerRef.customerModel,
      customerId: customerRefCustomerId(customerRef),
    };
    if (added.length) await emitAppEvent('customerRef.segmentsAdded', { ...subject, segmentIds: added });
    if (removed.length) await emitAppEvent('customerRef.segmentsRemoved', { ...subject, segmentIds: removed });
  }
};

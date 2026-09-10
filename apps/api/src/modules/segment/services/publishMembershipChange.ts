/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses primitive:appEvents, infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { emitAppEvent } from '#/appEvents/emit';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import type { MembershipDiff } from '#/modules/segment/services/applyMembershipDiff';

export const publishMembershipChange = async (segment: Segment, diff: MembershipDiff, db: Db = defaultDb) => {
  const changed = [...diff.added, ...diff.removed];
  const refs = changed.length ? await db.customerRef.findMany({ where: { id: { in: changed } } }) : [];
  const customerUserIds = [...new Set(refs.map((ref) => ref.customerUserId).filter((id): id is string => !!id))];

  await emitAppEvent('segment.membershipChanged', {
    segmentId: segment.id,
    ownerModel: segment.ownerModel,
    ownerId: segmentOwnerId(segment),
    added: diff.added,
    removed: diff.removed,
    customerUserIds,
  });
};

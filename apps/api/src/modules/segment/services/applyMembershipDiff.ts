/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
import { SegmentMemberSource } from '@template/db/generated/client/enums';
import { log } from '@template/shared/logger';

export type MembershipDiff = { added: string[]; removed: string[] };

const MASS_EVICTION_RATIO = 0.25;
const MASS_EVICTION_MIN_MEMBERS = 50;

type DiffScope = { segmentId: string; matching: Iterable<string>; within?: string[] };

export const applyMembershipDiff = async (
  { segmentId, matching, within }: DiffScope,
  db: Db = defaultDb,
): Promise<MembershipDiff> => {
  const matchingSet = new Set(matching);
  const current = await db.segmentMember.findMany({
    where: { segmentId, ...(within && { customerRefId: { in: within } }) },
  });
  const currentIds = new Set(current.map((member) => member.customerRefId));
  const pinned = new Set(
    current.filter((member) => member.source === SegmentMemberSource.manual).map((member) => member.customerRefId),
  );

  const toAdd = [...matchingSet].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !matchingSet.has(id) && !pinned.has(id));

  if (
    !within &&
    currentIds.size >= MASS_EVICTION_MIN_MEMBERS &&
    toRemove.length / currentIds.size > MASS_EVICTION_RATIO
  ) {
    log.warn(`reconcile evicting ${toRemove.length} of ${currentIds.size} members from segment ${segmentId}`);
  }

  let added: string[] = [];
  let removed: string[] = [];

  await db.txn(async () => {
    if (toAdd.length) {
      const written = await db.segmentMember.createManyAndReturn({
        data: toAdd.map((customerRefId) => ({ segmentId, customerRefId, source: SegmentMemberSource.rule })),
        skipDuplicates: true,
      });
      added = written.map((member) => member.customerRefId);
    }
    if (toRemove.length) {
      const doomed = await db.segmentMember.findMany({
        where: { segmentId, customerRefId: { in: toRemove }, source: SegmentMemberSource.rule },
      });
      removed = doomed.map((member) => member.customerRefId);
      if (doomed.length)
        await db.segmentMember.deleteMany({ where: { id: { in: doomed.map((member) => member.id) } } });
    }
  });

  return { added, removed };
};

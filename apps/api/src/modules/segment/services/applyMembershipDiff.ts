/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { type Db, db as defaultDb } from '@template/db';
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

  const toAdd = [...matchingSet].filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !matchingSet.has(id));

  if (
    !within &&
    currentIds.size >= MASS_EVICTION_MIN_MEMBERS &&
    toRemove.length / currentIds.size > MASS_EVICTION_RATIO
  ) {
    log.warn(`reconcile evicting ${toRemove.length} of ${currentIds.size} members from segment ${segmentId}`);
  }

  let added: string[] = [];

  await db.txn(async () => {
    if (toAdd.length) {
      const written = await db.segmentMember.createManyAndReturn({
        data: toAdd.map((customerRefId) => ({ segmentId, customerRefId })),
        skipDuplicates: true,
      });
      added = written.map((member) => member.customerRefId);
    }
    if (toRemove.length) await db.segmentMember.deleteMany({ where: { segmentId, customerRefId: { in: toRemove } } });
  });

  return { added, removed: toRemove };
};

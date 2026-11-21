/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { chunk } from 'lodash-es';

export type MembershipDiff = { added: string[]; removed: string[] };

const MASS_EVICTION_RATIO = 0.25;
const MASS_EVICTION_MIN_MEMBERS = 50;
const WRITE_CHUNK_SIZE = 2_000;

type DiffScope = { segmentId: string; matching: Iterable<string>; within?: string[] };

const membershipDiff = (matchingSet: Set<string>, currentIds: Set<string>) => ({
  toAdd: [...matchingSet].filter((id) => !currentIds.has(id)),
  toRemove: [...currentIds].filter((id) => !matchingSet.has(id)),
});

const applySegmentMemberWrites = async (
  segmentId: string,
  toAdd: string[],
  toRemove: string[],
): Promise<string[]> => {
  const added: string[] = [];
  for (const batch of chunk(toAdd, WRITE_CHUNK_SIZE)) {
    const written = await db.segmentMember.createManyAndReturn({
      data: batch.map((customerRelationshipId) => ({ segmentId, customerRelationshipId })),
      skipDuplicates: true,
    });
    for (const member of written) added.push(member.customerRelationshipId);
  }
  for (const batch of chunk(toRemove, WRITE_CHUNK_SIZE)) {
    await db.segmentMember.deleteMany({
      where: { segmentId, customerRelationshipId: { in: batch } },
    });
  }
  return added;
};

export const applyMembershipDiff = async ({
  segmentId,
  matching,
  within,
}: DiffScope): Promise<MembershipDiff> => {
  const matchingSet = new Set(matching);
  let added: string[] = [];
  let removed: string[] = [];
  let currentSize = 0;

  await db.txn(async () => {
    const current = await db.segmentMember.findMany({
      where: within ? { segmentId, customerRelationshipId: { in: within } } : { segmentId },
      select: { customerRelationshipId: true },
    });
    const currentIds = new Set(current.map((member) => member.customerRelationshipId));
    currentSize = currentIds.size;
    const { toAdd, toRemove } = membershipDiff(matchingSet, currentIds);
    added = await applySegmentMemberWrites(segmentId, toAdd, toRemove);
    removed = toRemove;
  });

  if (
    !within &&
    currentSize >= MASS_EVICTION_MIN_MEMBERS &&
    removed.length / currentSize > MASS_EVICTION_RATIO
  ) {
    log.warn(
      `reconcile evicting ${removed.length} of ${currentSize} members from segment ${segmentId}`,
    );
  }

  return { added, removed };
};

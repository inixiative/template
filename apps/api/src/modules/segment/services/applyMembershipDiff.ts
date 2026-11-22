/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma, primitive:shared
 */
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { ConcurrencyType, minimumConcurrencyLimitFor } from '@template/shared/utils';
import { chunk } from 'lodash-es';

export type MembershipDiff = { added: string[]; removed: string[] };

export class PartialMembershipDiffError extends Error {
  constructor(
    readonly committed: MembershipDiff,
    override readonly cause: unknown,
  ) {
    super(
      `Segment membership reconcile partially failed after committing ${committed.added.length} additions and ${committed.removed.length} removals`,
      { cause },
    );
    this.name = 'PartialMembershipDiffError';
  }
}

const MASS_EVICTION_RATIO = 0.25;
const MASS_EVICTION_MIN_MEMBERS = 50;
const CHUNK_SIZE = 2_000;

type DiffScope = {
  segmentId: string;
  matching: Iterable<string>;
  within?: string[];
  signal?: AbortSignal;
};

const membershipDiff = (matchingSet: Set<string>, currentIds: Set<string>) => ({
  toAdd: [...matchingSet].filter((id) => !currentIds.has(id)),
  toRemove: [...currentIds].filter((id) => !matchingSet.has(id)),
});

const fetchCurrentMemberIds = async (
  segmentId: string,
  signal?: AbortSignal,
): Promise<Set<string>> => {
  const ids = new Set<string>();
  let cursor: string | undefined;
  for (;;) {
    if (signal?.aborted) return ids;
    const rows = await db.segmentMember.findMany({
      where: cursor ? { segmentId, customerRelationshipId: { gt: cursor } } : { segmentId },
      select: { customerRelationshipId: true },
      orderBy: { customerRelationshipId: 'asc' },
      take: CHUNK_SIZE,
    });
    for (const row of rows) ids.add(row.customerRelationshipId);
    if (rows.length < CHUNK_SIZE) break;
    cursor = rows[rows.length - 1]?.customerRelationshipId;
  }
  return ids;
};

const makeSegmentMemberWrites = (
  segmentId: string,
  toAdd: string[],
  toRemove: string[],
  signal?: AbortSignal,
): Array<() => Promise<MembershipDiff>> => [
  ...chunk(toAdd, CHUNK_SIZE).map((batch) => async (): Promise<MembershipDiff> => {
    if (signal?.aborted) return { added: [], removed: [] };
    const written = await db.segmentMember.createManyAndReturn({
      data: batch.map((customerRelationshipId) => ({ segmentId, customerRelationshipId })),
      skipDuplicates: true,
    });
    return { added: written.map((member) => member.customerRelationshipId), removed: [] };
  }),
  ...chunk(toRemove, CHUNK_SIZE).map((batch) => async (): Promise<MembershipDiff> => {
    if (signal?.aborted) return { added: [], removed: [] };
    await db.segmentMember.deleteMany({
      where: { segmentId, customerRelationshipId: { in: batch } },
    });
    return { added: [], removed: batch };
  }),
];

const warnIfMassEviction = (segmentId: string, currentSize: number, removedCount: number): void => {
  if (
    currentSize >= MASS_EVICTION_MIN_MEMBERS &&
    removedCount / currentSize > MASS_EVICTION_RATIO
  ) {
    log.warn(
      `reconcile evicting ${removedCount} of ${currentSize} members from segment ${segmentId}`,
    );
  }
};

const mergeDiffs = (diffs: MembershipDiff[]): MembershipDiff => {
  const added: string[] = [];
  const removed: string[] = [];
  for (const diff of diffs) {
    added.push(...diff.added);
    removed.push(...diff.removed);
  }
  return { added, removed };
};

export const applyMembershipDiff = async ({
  segmentId,
  matching,
  within,
  signal,
}: DiffScope): Promise<MembershipDiff> => {
  const matchingSet = new Set(matching);

  if (within || db.isInTxn()) {
    let diff: MembershipDiff = { added: [], removed: [] };
    await db.txn(async () => {
      const currentIds = within
        ? new Set(
            (
              await db.segmentMember.findMany({
                where: { segmentId, customerRelationshipId: { in: within } },
                select: { customerRelationshipId: true },
              })
            ).map((member) => member.customerRelationshipId),
          )
        : await fetchCurrentMemberIds(segmentId, signal);
      if (signal?.aborted) return;
      const { toAdd, toRemove } = membershipDiff(matchingSet, currentIds);
      if (!within) warnIfMassEviction(segmentId, currentIds.size, toRemove.length);
      const completed: MembershipDiff[] = [];
      for (const write of makeSegmentMemberWrites(segmentId, toAdd, toRemove, signal)) {
        completed.push(await write());
      }
      diff = mergeDiffs(completed);
    });
    return diff;
  }

  const currentIds = await fetchCurrentMemberIds(segmentId, signal);
  if (signal?.aborted) return { added: [], removed: [] };
  const { toAdd, toRemove } = membershipDiff(matchingSet, currentIds);
  warnIfMassEviction(segmentId, currentIds.size, toRemove.length);

  const writes = makeSegmentMemberWrites(segmentId, toAdd, toRemove, signal);
  if (!writes.length) return { added: [], removed: [] };

  const settled = await db.parallel(writes, {
    concurrency: minimumConcurrencyLimitFor([ConcurrencyType.db]),
    resolution: 'allSettled',
  });

  const committed = mergeDiffs(
    settled
      .filter(
        (result): result is PromiseFulfilledResult<MembershipDiff> => result.status === 'fulfilled',
      )
      .map((result) => result.value),
  );
  const rejections = settled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);

  if (rejections.length) {
    const cause =
      rejections.length === 1
        ? rejections[0]
        : new AggregateError(rejections, `${rejections.length} segment diff chunks failed`);
    if (committed.added.length || committed.removed.length) {
      throw new PartialMembershipDiffError(committed, cause);
    }
    throw cause;
  }

  return committed;
};

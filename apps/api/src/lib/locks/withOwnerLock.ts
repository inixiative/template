/**
 * @atlas
 * @kind helper
 * @partOf mutex
 * @uses infrastructure:redis
 */
import { createLock } from '@template/db';
import { makeError } from '#/lib/errors';

// One scope per owner-wide invariant that row locks cannot protect. `rules` is the first: an
// owner's rule graph, where segment A may name segment B and B may name A, and a save of either
// validates against the graph and then writes into it. A new owner-wide, cross-row invariant adds
// a scope here rather than a second lock helper.
export type OwnerLockScope = 'rules';

type Owner = { ownerModel: string; ownerId: string };

// The TTL and heartbeat match the other transaction-length locks: a crashed holder frees the key in
// ten seconds, and the heartbeat keeps a slow save alive past that.
const OWNER_LOCK = { ttlMs: 10_000, heartbeatMs: 3_000 };
export const OWNER_LOCK_WAIT_MS = 3_000;

/**
 * Serializes writes that can collide across rows of one owner. Two admins saving segments that
 * name each other at the same moment each hold their own row and then wait for the other's; the
 * cycle check each ran saw a graph without the other's edge. The owner lock is taken before the
 * transaction opens, so it precedes every row lock, and every save in the scope goes through it in
 * the same order: the second waits for the first to commit, then validates against the graph the
 * first wrote. Other owners, and writes outside the scope, never wait.
 *
 * Not re-entrant: a caller already holding the owner's lock for the same scope waits on itself
 * until the timeout. Waiting longer than `waitMs` ends in a 409 with a retry message rather than a
 * hung request; these writes are admin-paced, so a wait that long means something other than a
 * neighbouring save.
 */
export const withOwnerLock = async <T>(
  { ownerModel, ownerId }: Owner,
  scope: OwnerLockScope,
  fn: () => Promise<T>,
  waitMs: number = OWNER_LOCK_WAIT_MS,
): Promise<T> => {
  const lock = createLock({
    ...OWNER_LOCK,
    service: `owner:${scope}`,
    identifier: `${ownerModel}:${ownerId}`,
  });
  await lock.acquire({
    waitMs,
    onTimeout: () =>
      makeError({
        status: 409,
        message: `Another change to this ${ownerModel}'s ${scope} is still in progress; please retry`,
      }),
  });
  try {
    return await fn();
  } finally {
    await lock.release();
  }
};

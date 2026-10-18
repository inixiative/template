/**
 * @atlas
 * @kind helper
 * @partOf mutex
 * @uses infrastructure:redis
 */
import { createLock, db } from '@template/db';
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
 * cycle check each ran saw a graph without the other's edge. Every save in the scope goes through
 * the lock, so the second waits for the first to commit, then validates against the graph the first
 * wrote. Other owners, and writes outside the scope, never wait.
 *
 * The lock is held until the writes made under it are committed. Called outside a transaction it is
 * taken before `fn` opens its own and released when `fn` returns, so it precedes every row lock.
 * Called inside one (a `transactionAll` batch's sub-request, or any write inside `db.txn`), `fn`'s
 * writes commit only with that transaction, so the lock rides `db.withLockUntilSettled` and drops
 * when the transaction settles, commit or rollback. A second take in the same transaction joins the
 * first instead of waiting on itself, and runs after the holders before it (parallel sub-requests of
 * one batch round each validate against what the one before wrote). Outside a transaction it is not re-entrant: a caller already
 * holding the owner's lock for the same scope waits on itself until the timeout.
 *
 * Waiting longer than `waitMs` ends in a 409 with a retry message rather than a hung request; these
 * writes are admin-paced, so a wait that long means something other than a neighbouring save.
 * Inside a transaction the 409 rolls it back, which also frees any row locks it held while waiting.
 */
export const withOwnerLock = async <T>(
  { ownerModel, ownerId }: Owner,
  scope: OwnerLockScope,
  fn: () => Promise<T>,
  waitMs: number = OWNER_LOCK_WAIT_MS,
): Promise<T> => {
  const lockOptions = {
    ...OWNER_LOCK,
    service: `owner:${scope}`,
    identifier: `${ownerModel}:${ownerId}`,
  };
  const acquireOptions = {
    waitMs,
    onTimeout: () =>
      makeError({
        status: 409,
        message: `Another change to this ${ownerModel}'s ${scope} is still in progress; please retry`,
      }),
  };

  if (db.isInTxn()) return db.withLockUntilSettled(lockOptions, fn, acquireOptions);

  const lock = createLock(lockOptions);
  await lock.acquire(acquireOptions);
  try {
    return await fn();
  } finally {
    await lock.release();
  }
};

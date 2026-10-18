/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import type { HeldLock, OpenTransaction } from '@template/db/clientTypes';
import { createLock } from '@template/db/lock/createLock';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { AcquireOptions, Lock, LockOptions } from '@template/db/lock/types';
import { log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';

const acquireForTransaction = async (
  openTransaction: OpenTransaction,
  key: string,
  lock: Lock,
  acquireOptions: AcquireOptions,
): Promise<void> => {
  if (!(await lock.acquire(acquireOptions)))
    throw new Error(`transaction lock ${key} is held by another holder`);
  openTransaction.finallyFns.push(async () => {
    openTransaction.heldLocks.delete(key);
    const result = await lock.release();
    if (result !== 'released') log.warn(`transaction lock release ${result}: ${key}`);
  });
};

// Writes made under a lock inside a transaction are invisible to everyone else until the commit, so
// the lock rides the transaction's finally queue and drops once it has settled, commit or rollback.
// Every holder in one transaction (a nested db.txn, a batch's sub-requests, parallel branches of one
// round) shares the transaction's one acquisition of a key: a second take of a key the transaction
// holds, or is still waiting for, joins that acquisition instead of waiting on itself.
export const holdLockUntilSettled = async (
  openTransaction: OpenTransaction,
  options: LockOptions,
  acquireOptions: AcquireOptions = {},
): Promise<HeldLock> => {
  const key = lockKeyOf(options);
  const existing = openTransaction.heldLocks.get(key);
  if (existing) {
    await existing.acquired;
    return existing;
  }

  const held: HeldLock = {
    acquired: acquireForTransaction(openTransaction, key, createLock(options), acquireOptions),
    holders: createSerializedQueue({ onError: () => {} }),
  };
  openTransaction.heldLocks.set(key, held);
  try {
    await held.acquired;
  } catch (error) {
    openTransaction.heldLocks.delete(key);
    throw error;
  }
  return held;
};

/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import type { HeldLock, OpenTransaction } from '@template/db/clientTypes';
import { createLock } from '@template/db/lock/createLock';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { AcquireOptions, LockOptions } from '@template/db/lock/types';
import { log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';

const acquire = async (
  key: string,
  options: LockOptions,
  acquireOptions: AcquireOptions,
): Promise<() => Promise<void>> => {
  const lock = createLock(options);
  if (!(await lock.acquire(acquireOptions)))
    throw new Error(`transaction lock ${key} is held by another holder`);
  return async () => {
    const result = await lock.release();
    if (result !== 'released') log.warn(`transaction lock release ${result}: ${key}`);
  };
};

// why: the release is queued before the wait, so an acquisition that finishes after the drain is still released.
const holdOnce = (
  openTransaction: OpenTransaction,
  key: string,
  options: LockOptions,
  acquireOptions: AcquireOptions,
): HeldLock => {
  const releasing = acquire(key, options, acquireOptions);
  const held: HeldLock = {
    acquired: releasing.then(() => undefined),
    holders: createSerializedQueue({ onError: () => {} }),
    settled: false,
  };
  openTransaction.heldLocks.set(key, held);
  openTransaction.finallyFns.push(async () => {
    held.settled = true;
    if (openTransaction.heldLocks.get(key) === held) openTransaction.heldLocks.delete(key);
    const release = await releasing.catch(() => null);
    await release?.();
  });
  return held;
};

export const holdLockUntilSettled = async (
  openTransaction: OpenTransaction,
  options: LockOptions,
  acquireOptions: AcquireOptions = {},
): Promise<HeldLock> => {
  const key = lockKeyOf(options);
  const held =
    openTransaction.heldLocks.get(key) ?? holdOnce(openTransaction, key, options, acquireOptions);
  try {
    await held.acquired;
  } catch (error) {
    if (openTransaction.heldLocks.get(key) === held) openTransaction.heldLocks.delete(key);
    throw error;
  }
  if (held.settled) throw new Error(`transaction settled while waiting for lock ${key}`);
  return held;
};

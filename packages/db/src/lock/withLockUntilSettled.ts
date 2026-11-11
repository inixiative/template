/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { OpenTransaction } from '@template/db/clientTypes';
import { holdLockUntilSettled } from '@template/db/lock/holdLockUntilSettled';
import { isTransactionOpen } from '@template/db/lock/isTransactionOpen';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { AcquireOptions, LockOptions, LockTarget } from '@template/db/lock/types';

const keysHeldByCaller = new AsyncLocalStorage<ReadonlySet<string>>();

export const withLockUntilSettled = async <T>(
  openTransaction: OpenTransaction,
  options: LockOptions & LockTarget,
  fn: () => Promise<T>,
  acquireOptions?: AcquireOptions,
): Promise<T> => {
  const key = lockKeyOf(options);
  const callerKeys = keysHeldByCaller.getStore();
  if (callerKeys?.has(key)) return fn();

  const held = await holdLockUntilSettled(openTransaction, options, acquireOptions);
  return held.holders.run(async () => {
    // A holder queued behind a sibling must not run once the transaction has ended under it: its
    // writes would escape both the rolled-back transaction and the released lock.
    if (!isTransactionOpen(openTransaction))
      throw new Error(`transaction settled while waiting for lock ${key}`);
    return keysHeldByCaller.run(new Set([...(callerKeys ?? []), key]), fn);
  });
};

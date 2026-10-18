/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { OpenTransaction } from '@template/db/clientTypes';
import { holdLockUntilSettled } from '@template/db/lock/holdLockUntilSettled';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { AcquireOptions, LockOptions } from '@template/db/lock/types';

const keysHeldByCaller = new AsyncLocalStorage<ReadonlySet<string>>();

export const withLockUntilSettled = async <T>(
  openTransaction: OpenTransaction,
  options: LockOptions,
  fn: () => Promise<T>,
  acquireOptions?: AcquireOptions,
): Promise<T> => {
  const key = lockKeyOf(options);
  const callerKeys = keysHeldByCaller.getStore();
  if (callerKeys?.has(key)) return fn();

  const held = await holdLockUntilSettled(openTransaction, options, acquireOptions);
  return held.holders.run(() => keysHeldByCaller.run(new Set([...(callerKeys ?? []), key]), fn));
};

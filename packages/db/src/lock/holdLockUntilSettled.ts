/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
import type { HeldLock, OpenTransaction } from '@template/db/clientTypes';
import { createLock } from '@template/db/lock/createLock';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import type { AcquireOptions, LockOptions, LockTarget } from '@template/db/lock/types';
import { log } from '@template/shared/logger';
import { createSerializedQueue } from '@template/shared/utils';

export type LockSetUntilSettledOptions = Omit<LockOptions, 'identifier' | 'identifiers' | 'key'> & {
  service: string;
};

// onTimeout is told the identifiers the set was waiting to take, sorted; the joined ones are not
// among them.
export type LockSetAcquireOptions = Omit<AcquireOptions, 'onTimeout'> & {
  onTimeout?: (pendingIdentifiers: string[]) => Error;
};

const labelOf = (keys: readonly string[]): string =>
  keys.length === 1 ? (keys[0] as string) : `${keys[0]} (+${keys.length - 1})`;

const acquire = async (
  label: string,
  options: LockOptions,
  acquireOptions: AcquireOptions,
): Promise<() => Promise<void>> => {
  const lock = createLock(options);
  try {
    if (!(await lock.acquire(acquireOptions)))
      throw new Error(`transaction lock ${label} is held by another holder`);
  } catch (error) {
    // acquire() has already given back the keys a set won; the fenced release also frees a key an
    // errored acquire may still have written, rather than leaving it to its TTL.
    await lock.release();
    throw error;
  }
  return async () => {
    const result = await lock.release();
    if (result !== 'released') log.warn(`transaction lock release ${result}: ${label}`);
  };
};

// One lock over `keys`: every key is registered against the same acquisition and the lock is
// released once, when the transaction settles. Each key keeps its own holder queue, so
// withLockUntilSettled on one key of a set never waits on a holder of another.
const holdOnce = (
  openTransaction: OpenTransaction,
  keys: readonly string[],
  options: LockOptions,
  acquireOptions: AcquireOptions,
): HeldLock[] => {
  const label = labelOf(keys);
  if (openTransaction.settled) throw new Error(`transaction settled before taking lock ${label}`);
  const releasing = acquire(label, options, acquireOptions);
  const acquired = releasing.then(() => undefined);
  const registered = keys.map((key) => {
    const held: HeldLock = { acquired, holders: createSerializedQueue({ onError: () => {} }) };
    openTransaction.heldLocks.set(key, held);
    return [key, held] as const;
  });
  const forget = () => {
    for (const [key, held] of registered)
      if (openTransaction.heldLocks.get(key) === held) openTransaction.heldLocks.delete(key);
  };
  acquired.catch(forget);
  openTransaction.finallyFns.push(async () => {
    forget();
    const release = await releasing.catch(() => null);
    await release?.();
  });
  return registered.map(([, held]) => held);
};

const awaitHeld = async (
  openTransaction: OpenTransaction,
  label: string,
  held: readonly HeldLock[],
): Promise<void> => {
  await Promise.all(held.map(({ acquired }) => acquired));
  if (openTransaction.settled)
    throw new Error(`transaction settled while waiting for lock ${label}`);
};

export const holdLockUntilSettled = async (
  openTransaction: OpenTransaction,
  options: LockOptions & LockTarget,
  acquireOptions: AcquireOptions = {},
): Promise<HeldLock> => {
  const key = lockKeyOf(options);
  const held =
    openTransaction.heldLocks.get(key) ??
    (holdOnce(openTransaction, [key], options, acquireOptions)[0] as HeldLock);
  await awaitHeld(openTransaction, key, [held]);
  return held;
};

// One lock set over the identifiers this transaction does not hold yet, joining the ones it already
// holds: by an earlier call, by a parallel call still acquiring, or by withLockUntilSettled on the
// same key. The pending set is one token, one heartbeat and one release.
export const holdLockSetUntilSettled = async (
  openTransaction: OpenTransaction,
  { service, ...options }: LockSetUntilSettledOptions,
  identifiers: readonly string[],
  { onTimeout, ...acquireOptions }: LockSetAcquireOptions = {},
): Promise<void> => {
  const keyed = [...new Set(identifiers)]
    .sort()
    .map((identifier) => [identifier, lockKeyOf({ service, identifier })] as const);
  if (!keyed.length) return;
  const joined = keyed.flatMap(([, key]) => openTransaction.heldLocks.get(key) ?? []);
  const pending = keyed.filter(([, key]) => !openTransaction.heldLocks.has(key));
  const pendingIdentifiers = pending.map(([identifier]) => identifier);
  const taken = pending.length
    ? holdOnce(
        openTransaction,
        pending.map(([, key]) => key),
        { ...options, service, identifiers: pendingIdentifiers },
        { ...acquireOptions, onTimeout: onTimeout && (() => onTimeout(pendingIdentifiers)) },
      )
    : [];
  await awaitHeld(openTransaction, labelOf(keyed.map(([, key]) => key)), [...joined, ...taken]);
};

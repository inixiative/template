/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { findForUpdateLockIdentifiers } from '@template/db/lock/findForUpdateLockIdentifier';
import { FindForUpdateLockTimeoutError } from '@template/db/lock/findForUpdateLockTimeoutError';
import { holdLockUntilSettled } from '@template/db/lock/holdLockUntilSettled';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';

export const FIND_FOR_UPDATE_LOCK_SERVICE = 'find-for-update';
// why: a holder keeps the key only as long as its transaction, and callers can raise the
// why: transaction timeout, so the lease is heartbeat-renewed; the TTL is what frees the key when
// why: a crashed process never reaches its release. (1 + 1) * 3s < 10s passes createLock's check.
const FIND_FOR_UPDATE_LOCK = {
  service: FIND_FOR_UPDATE_LOCK_SERVICE,
  ttlMs: 10_000,
  heartbeatMs: 3_000,
  maxMissed: 1,
};
// why: the waiter holds an open transaction while it waits. The wait must end, and the waiter roll
// why: back, well inside Prisma's interactive default of 5s (this client configures 30s), or the
// why: transaction timeout fires first and surfaces as a closed-transaction error instead.
export const FIND_FOR_UPDATE_LOCK_WAIT_MS = 3_000;
const FIND_FOR_UPDATE_LOCK_POLL_MS = 25;

const keyFor = (identifier: string): string =>
  lockKeyOf({ service: FIND_FOR_UPDATE_LOCK_SERVICE, identifier });

// Lock first, then fence: querying first lets two callers both see no row before either locks.
// Each key is held through holdLockUntilSettled, so it drops once the transaction has settled,
// commit or rollback — never before the commit a waiter must read, and never behind the on-commit
// side effects — and a key this transaction already holds is not taken again.
//
// A batch takes one ordinary lock per key, the same lock a single-row fence takes, one at a time in
// sorted order, holding each while it waits on the next. Every writer orders its keys the same way,
// so two batches that share keys meet on the lowest shared key first and the loser waits behind the
// winner; neither can hold a key the other needs while waiting on one it holds. (Taking them in
// parallel and releasing partial wins let two batches listing the same rows in opposite orders keep
// knocking each other back until both timed out.) The deadline covers the whole batch. A timeout
// rolls the transaction back, which releases every key already taken. The sort orders keys within
// one call; across calls in one transaction, the call order does, so fence a row's unique keys in
// one fixed order at every writer.
export const acquireFindForUpdateLock = async (
  openTransaction: OpenTransaction,
  model: string,
  where: Record<string, unknown>,
  waitMs: number = FIND_FOR_UPDATE_LOCK_WAIT_MS,
): Promise<void> => {
  const identifiers = [...new Set(findForUpdateLockIdentifiers(model, where))].sort();
  if (!identifiers.length) return;
  const timeoutKey =
    identifiers.length === 1
      ? keyFor(identifiers[0] as string)
      : `${keyFor(identifiers[0] as string)} (+${identifiers.length - 1})`;

  const deadline = Date.now() + waitMs;
  for (const identifier of identifiers) {
    await holdLockUntilSettled(
      openTransaction,
      { ...FIND_FOR_UPDATE_LOCK, identifier },
      {
        waitMs: Math.max(deadline - Date.now(), 0),
        pollMs: FIND_FOR_UPDATE_LOCK_POLL_MS,
        onTimeout: () => new FindForUpdateLockTimeoutError(timeoutKey, waitMs),
      },
    );
  }
};

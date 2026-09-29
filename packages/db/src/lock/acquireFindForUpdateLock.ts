/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { createLock } from '@template/db/lock/createLock';
import { findForUpdateLockIdentifier } from '@template/db/lock/findForUpdateLockIdentifier';
import { FindForUpdateLockTimeoutError } from '@template/db/lock/findForUpdateLockTimeoutError';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';

export const FIND_FOR_UPDATE_LOCK_SERVICE = 'find-for-update';
// why: a holder keeps the key only as long as its transaction, and callers can raise the
// why: transaction timeout, so the lease is heartbeat-renewed; the TTL is what frees the key when
// why: a crashed process never reaches its release. (1 + 1) * 3s < 10s passes createLock's check.
const FIND_FOR_UPDATE_LOCK_TTL_MS = 10_000;
const FIND_FOR_UPDATE_LOCK_HEARTBEAT_MS = 3_000;
// why: the waiter holds an open transaction while it waits. The wait must end, and the waiter roll
// why: back, well inside Prisma's interactive default of 5s (this client configures 30s), or the
// why: transaction timeout fires first and surfaces as a closed-transaction error instead.
export const FIND_FOR_UPDATE_LOCK_WAIT_MS = 3_000;
const FIND_FOR_UPDATE_LOCK_POLL_MS = 25;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Lock first, then fence: querying first lets two callers both see no row before either locks.
// The release rides the transaction's finally queue, so the key drops once the transaction has
// settled, commit or rollback — never before the commit a waiter must read, and never behind the
// on-commit side effects.
export const acquireFindForUpdateLock = async (
  openTransaction: OpenTransaction,
  model: string,
  where: Record<string, unknown>,
  waitMs: number = FIND_FOR_UPDATE_LOCK_WAIT_MS,
): Promise<void> => {
  const identifier = findForUpdateLockIdentifier(model, where);
  const key = `${redisNamespace.lock}:${FIND_FOR_UPDATE_LOCK_SERVICE}:${identifier}`;
  if (openTransaction.heldLockKeys.has(key)) return;

  const lock = createLock({
    service: FIND_FOR_UPDATE_LOCK_SERVICE,
    identifier,
    ttlMs: FIND_FOR_UPDATE_LOCK_TTL_MS,
    heartbeatMs: FIND_FOR_UPDATE_LOCK_HEARTBEAT_MS,
    maxMissed: 1,
  });

  const deadline = Date.now() + waitMs;
  while (!(await lock.acquire())) {
    if (Date.now() >= deadline) throw new FindForUpdateLockTimeoutError(key, waitMs);
    await sleep(Math.min(FIND_FOR_UPDATE_LOCK_POLL_MS, Math.max(deadline - Date.now(), 0)));
  }

  openTransaction.heldLockKeys.add(key);
  openTransaction.finallyFns.push(async () => {
    openTransaction.heldLockKeys.delete(key);
    const result = await lock.release();
    if (result !== 'released') log.warn(`db.findForUpdate() lock release ${result}: ${key}`);
  });
};

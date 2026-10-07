/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { createLock } from '@template/db/lock/createLock';
import { findForUpdateLockIdentifiers } from '@template/db/lock/findForUpdateLockIdentifier';
import { FindForUpdateLockTimeoutError } from '@template/db/lock/findForUpdateLockTimeoutError';
import type { Lock } from '@template/db/lock/types';
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

const keyFor = (identifier: string): string =>
  `${redisNamespace.lock}:${FIND_FOR_UPDATE_LOCK_SERVICE}:${identifier}`;

const createFindForUpdateLock = (identifier: string): Lock =>
  createLock({
    service: FIND_FOR_UPDATE_LOCK_SERVICE,
    identifier,
    ttlMs: FIND_FOR_UPDATE_LOCK_TTL_MS,
    heartbeatMs: FIND_FOR_UPDATE_LOCK_HEARTBEAT_MS,
    maxMissed: 1,
  });

const releaseAll = (locks: Lock[]) => Promise.all(locks.map((lock) => lock.release()));

// Lock first, then fence: querying first lets two callers both see no row before either locks.
// The release rides the transaction's finally queue, so the key drops once the transaction has
// settled, commit or rollback — never before the commit a waiter must read, and never behind the
// on-commit side effects.
//
// A batch takes one ordinary lock per key, the same lock a single-row fence takes, one at a time in
// sorted order, holding each while it waits on the next. Every writer orders its keys the same way,
// so two batches that share keys meet on the lowest shared key first and the loser waits behind the
// winner; neither can hold a key the other needs while waiting on one it holds. (Taking them in
// parallel and releasing partial wins let two batches listing the same rows in opposite orders keep
// knocking each other back until both timed out.) The deadline covers the whole batch. Keys this
// transaction already holds are skipped. A timeout or a Redis error releases every key already taken
// before it propagates, or their heartbeats would keep them alive. The sort orders keys within one
// call; across calls in one transaction, the call order does, so fence a row's unique keys in one
// fixed order at every writer.
export const acquireFindForUpdateLock = async (
  openTransaction: OpenTransaction,
  model: string,
  where: Record<string, unknown>,
  waitMs: number = FIND_FOR_UPDATE_LOCK_WAIT_MS,
): Promise<void> => {
  const identifiers = findForUpdateLockIdentifiers(model, where).filter(
    (identifier) => !openTransaction.heldLockKeys.has(keyFor(identifier)),
  );
  if (!identifiers.length) return;

  const deadline = Date.now() + waitMs;
  const entries: { key: string; lock: Lock }[] = [];
  try {
    for (const identifier of [...new Set(identifiers)].sort()) {
      const lock = createFindForUpdateLock(identifier);
      await lock.acquire({
        waitMs: Math.max(deadline - Date.now(), 0),
        pollMs: FIND_FOR_UPDATE_LOCK_POLL_MS,
        onTimeout: () =>
          new FindForUpdateLockTimeoutError(
            identifiers.length === 1
              ? keyFor(identifier)
              : `${keyFor(identifiers[0] as string)} (+${identifiers.length - 1})`,
            waitMs,
          ),
      });
      entries.push({ key: keyFor(identifier), lock });
    }
  } catch (error) {
    await releaseAll(entries.map(({ lock }) => lock));
    throw error;
  }

  for (const { key, lock } of entries) {
    openTransaction.heldLockKeys.add(key);
    openTransaction.finallyFns.push(async () => {
      openTransaction.heldLockKeys.delete(key);
      const result = await lock.release();
      if (result !== 'released') log.warn(`db.findForUpdate() lock release ${result}: ${key}`);
    });
  }
};

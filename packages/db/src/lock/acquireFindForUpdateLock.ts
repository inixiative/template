/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
import type { OpenTransaction } from '@template/db/clientTypes';
import { findForUpdateLockIdentifiers } from '@template/db/lock/findForUpdateLockIdentifier';
import { FindForUpdateLockTimeoutError } from '@template/db/lock/findForUpdateLockTimeoutError';
import { holdLockSetUntilSettled } from '@template/db/lock/holdLockUntilSettled';

export const FIND_FOR_UPDATE_LOCK_SERVICE = 'find-for-update';
const FIND_FOR_UPDATE_LOCK = {
  service: FIND_FOR_UPDATE_LOCK_SERVICE,
  ttlMs: 10_000,
  heartbeatMs: 3_000,
};
export const FIND_FOR_UPDATE_LOCK_WAIT_MS = 3_000;
const FIND_FOR_UPDATE_LOCK_POLL_MS = 25;

// The whole call is one lock and one wait over the identifiers this transaction does not hold yet:
// one script call per poll, one heartbeat, one release when the transaction settles. Each key is
// the one a single-row fence on that identifier takes, so a batch and a single-row writer contend
// on exactly the same Redis key. A wait that runs out gives back the keys won so far and throws
// FindForUpdateLockTimeoutError, naming the first pending identifier and the count of the rest.
export const acquireFindForUpdateLock = async (
  openTransaction: OpenTransaction,
  model: string,
  where: Record<string, unknown>,
  waitMs: number = FIND_FOR_UPDATE_LOCK_WAIT_MS,
): Promise<void> => {
  const identifiers = findForUpdateLockIdentifiers(model, where);
  await holdLockSetUntilSettled(openTransaction, FIND_FOR_UPDATE_LOCK, identifiers, {
    waitMs,
    pollMs: FIND_FOR_UPDATE_LOCK_POLL_MS,
    onTimeout: ([first, ...rest]) =>
      new FindForUpdateLockTimeoutError(
        model,
        rest.length ? `${first} (+${rest.length})` : (first as string),
        waitMs,
      ),
  });
};

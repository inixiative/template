/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
// The timeout-aware ceiling for heartbeatMs. `TOLERATED_REFRESH_FAILURES + 1` beats may each spend the command
// timeout before the next is scheduled, and the acquire reply that starts the local clock may
// spend one too; all of it must fit inside the TTL. The constructor's
// `2 * heartbeatMs < ttlMs` check is the looser bound — an interval above this
// ceiling passes it and still lets the lease lapse after one timed-out beat. Strictly inside the
// budget: at the boundary the recovery beat's PEXPIRE can land in the millisecond the key expires.
// Defaults to the command timeout every non-blocking connection from createRedisConnection sets.
import { COMMAND_TIMEOUT_MS } from '@template/db/redis/client';

export const TOLERATED_REFRESH_FAILURES = 1;

export const maxSafeHeartbeatMs = ({
  ttlMs,
  commandTimeoutMs = COMMAND_TIMEOUT_MS,
}: {
  ttlMs: number;
  commandTimeoutMs?: number;
}): number => {
  const heartbeatMs =
    Math.ceil((ttlMs - commandTimeoutMs) / (TOLERATED_REFRESH_FAILURES + 1) - commandTimeoutMs) - 1;
  if (heartbeatMs <= 0) {
    throw new Error(
      `createLock: ttlMs ${ttlMs} leaves no room for a heartbeat with a ${commandTimeoutMs} ms command timeout`,
    );
  }
  return heartbeatMs;
};

/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
// The timeout-aware ceiling for heartbeatMs. `maxMissed + 1` beats may each spend the command
// timeout before the next is scheduled, and the acquire reply that starts the local clock may
// spend one too; all of it must fit inside the TTL. The constructor's
// `(maxMissed + 1) * heartbeatMs < ttlMs` check is the looser bound — an interval above this
// ceiling passes it and still lets the lease lapse after one timed-out beat. Strictly inside the
// budget: at the boundary the recovery beat's PEXPIRE can land in the millisecond the key expires.
// No connection this package creates sets a command timeout yet, so the caller passes the timeout
// of the connection the lock runs on; a connection without one can hang a beat forever.
export const maxSafeHeartbeatMs = ({
  ttlMs,
  maxMissed = 1,
  commandTimeoutMs,
}: {
  ttlMs: number;
  maxMissed?: number;
  commandTimeoutMs: number;
}): number => {
  const heartbeatMs = Math.ceil((ttlMs - commandTimeoutMs) / (maxMissed + 1) - commandTimeoutMs) - 1;
  if (heartbeatMs <= 0) {
    throw new Error(
      `createLock: ttlMs ${ttlMs} leaves no room for a heartbeat with a ${commandTimeoutMs} ms command timeout`,
    );
  }
  return heartbeatMs;
};

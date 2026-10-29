/**
 * @atlas
 * @kind constructor
 * @partOf infrastructure:prisma, infrastructure:redis, mutex
 * @uses none
 */
// Single-node Redis lock. Footguns:
//   - Not Redlock — do not rely across cluster nodes.
//   - Worker suspension > ttlMs (debugger pause, OS sleep) → key expires + another holder takes it
//     + we wake up thinking we hold it. Mitigation: ttlMs >> expected pause duration.
//   - verify() is point-in-time; the race between verify-returns-true and the next op
//     completing is microseconds but non-zero. For exactly-once semantics, fence at the resource.
import { createClaim } from '@template/db/lock/createClaim';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';
import { LockLostError } from '@template/db/lock/lockLostError';
import { TOLERATED_REFRESH_FAILURES } from '@template/db/lock/maxSafeHeartbeatMs';
import { fencedDelete } from '@template/db/lock/queries/fencedDelete';
import { fencedRefresh } from '@template/db/lock/queries/fencedRefresh';
import type {
  AcquireOptions,
  Claim,
  ClaimOptions,
  Lock,
  LockOptions,
  LockRedis,
  LockReleaseResult,
} from '@template/db/lock/types';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';

const DEFAULT_POLL_MS = 50;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createLock(opts: ClaimOptions): Claim;
export function createLock(opts: LockOptions): Lock;
export function createLock(opts: LockOptions | ClaimOptions): Lock | Claim {
  const redisClient = opts.redis ?? getRedisClient();
  const lockKey = lockKeyOf(opts);
  if (opts.heartbeat === false) return createClaim(opts, redisClient, lockKey);
  return createRenewingLock(opts, redisClient, lockKey);
}

const createRenewingLock = (opts: LockOptions, redis: LockRedis, key: string): Lock => {
  const { ttlMs = 30_000, heartbeatMs = 10_000, onLockLost } = opts;

  if (heartbeatMs <= 0) {
    throw new Error(`createLock: heartbeatMs must be > 0, got ${heartbeatMs}`);
  }
  if ((TOLERATED_REFRESH_FAILURES + 1) * heartbeatMs >= ttlMs) {
    throw new Error(
      `createLock: unsafe config — heartbeatMs ${heartbeatMs}ms must leave room for one failed refresh before ttlMs ${ttlMs}ms`,
    );
  }

  const processId = crypto.randomUUID();
  let stop: (() => void) | null = null;
  let hasDeclaredLoss = false;
  let hasReleased = false;
  let hasAcquired = false;
  let hasLostLease = false;
  let leaseValidUntil = 0;
  let releasePromise: Promise<LockReleaseResult> | null = null;

  const stopHeartbeat = () => {
    stop?.();
    stop = null;
  };

  // `unconfirmed`: the delete threw, but ioredis may still send it after a reconnect. The key is
  // freed if the delete still reaches Redis, otherwise at its TTL — say so, don't stay silent.
  const compareAndDelete = async (): Promise<LockReleaseResult> => {
    try {
      return (await fencedDelete(redis, key, processId)) ? 'released' : 'notHeld';
    } catch (err) {
      log.error(
        `Lock fenced delete unconfirmed; the key is freed if the delete still reaches Redis, otherwise at its TTL: ${key}`,
        err,
      );
      return 'unconfirmed';
    }
  };

  // Only a token mismatch is a loss; a Redis error is uncertainty, and the heartbeat keeps refreshing.
  const declareLost = (): void => {
    if (hasDeclaredLoss || hasReleased) return;
    hasDeclaredLoss = true;
    log.warn(`Lock lost: ${key}`);
    if (!onLockLost) return;
    try {
      void Promise.resolve(onLockLost()).catch((err) =>
        log.error(`Lock onLockLost callback failed: ${key}`, err),
      );
    } catch (err) {
      log.error(`Lock onLockLost callback failed: ${key}`, err);
    }
  };

  const tick = async () => {
    let renewed: boolean;
    const sentAt = performance.now();
    try {
      renewed = await fencedRefresh(redis, key, processId, ttlMs);
    } catch (err) {
      log.warn(`Lock refresh failed: ${key}`, err);
      return;
    }
    if (renewed) {
      leaseValidUntil = sentAt + ttlMs;
      return;
    }
    stopHeartbeat();
    declareLost();
  };

  const tryAcquire = async (): Promise<boolean> => {
    if (hasReleased) {
      throw new Error('createLock: this lock was released; create a new lock to acquire again');
    }
    const sentAt = performance.now();
    const result = await redis.set(key, processId, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return false;
    if (hasReleased) {
      await compareAndDelete();
      return false;
    }
    hasAcquired = true;
    leaseValidUntil = sentAt + ttlMs;
    stop = heartbeat(tick, heartbeatMs, {
      onError: (err) => log.error(`Lock heartbeat error: ${key}`, err),
    });
    return true;
  };

  // The poll is a sleep, not a Redis blocking primitive: a waiter costs one SET per poll and
  // nothing while asleep. A waiter polling inside an interactive transaction must keep `waitMs`
  // under that transaction's own timeout, or it expires while still waiting.
  const acquire = async ({
    waitMs = 0,
    pollMs = DEFAULT_POLL_MS,
    onTimeout,
  }: AcquireOptions = {}): Promise<boolean> => {
    const deadline = Date.now() + waitMs;
    while (!(await tryAcquire())) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        if (onTimeout) throw onTimeout();
        return false;
      }
      await sleep(Math.min(pollMs, remaining));
    }
    return true;
  };

  const verify = async (): Promise<boolean> => {
    if (hasDeclaredLoss || hasReleased) return false;
    const current = await redis.get(key);
    return current === processId;
  };

  // Timed from each SET/refresh send so a late reply never extends it; once lapsed it stays lapsed.
  const isWithinLease = (): boolean => {
    if (!hasAcquired || hasLostLease) return false;
    if (hasReleased || hasDeclaredLoss || performance.now() >= leaseValidUntil) {
      hasLostLease = true;
      return false;
    }
    return true;
  };

  const assertHeld = (): void => {
    if (!isWithinLease()) throw new LockLostError(key);
  };

  const release = (): Promise<LockReleaseResult> => {
    if (releasePromise) return releasePromise;
    hasReleased = true;
    stopHeartbeat();
    releasePromise = compareAndDelete();
    return releasePromise;
  };

  return { acquire, verify, release, isWithinLease, assertHeld };
};

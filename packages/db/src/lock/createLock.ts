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
import { fencedDelete } from '@template/db/lock/queries/fencedDelete';
import { fencedRefresh } from '@template/db/lock/queries/fencedRefresh';
import type { Lock, LockLostReason, LockOptions, LockReleaseResult } from '@template/db/lock/types';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';

export const createLock = (opts: LockOptions): Lock => {
  const { ttlMs = 30_000, heartbeatMs = 10_000, maxMissed = 1, onLockLost } = opts;

  if (maxMissed < 1) {
    throw new Error(`createLock: maxMissed must be >= 1, got ${maxMissed}`);
  }
  if (heartbeatMs <= 0) {
    throw new Error(`createLock: heartbeatMs must be > 0, got ${heartbeatMs}`);
  }
  if ((maxMissed + 1) * heartbeatMs >= ttlMs) {
    throw new Error(
      `createLock: unsafe config — (maxMissed + 1) * heartbeatMs (${(maxMissed + 1) * heartbeatMs}ms) must be < ttlMs (${ttlMs}ms)`,
    );
  }

  const redis = opts.redis ?? getRedisClient();
  const key = 'key' in opts ? opts.key : `${redisNamespace.lock}:${opts.service}:${opts.identifier}`;
  const processId = crypto.randomUUID();
  let stop: (() => void) | null = null;
  let missed = 0;
  let hasDeclaredLoss = false;
  let hasReleased = false;

  const stopHeartbeat = () => {
    stop?.();
    stop = null;
  };

  // `unconfirmed`: the delete threw, but ioredis may still send it after a reconnect. The key is
  // freed if the delete still reaches Redis, otherwise at its TTL — say so, don't stay silent.
  const compareAndDelete = async (): Promise<LockReleaseResult> => {
    try {
      const result = await fencedDelete(redis, key, processId);
      return result === 1 ? 'released' : 'notHeld';
    } catch (err) {
      log.error(
        `Lock fenced delete unconfirmed; the key is freed if the delete still reaches Redis, otherwise at its TTL: ${key}`,
        err,
      );
      return 'unconfirmed';
    }
  };

  // Never deletes: a spent missed-beat budget means ownership is uncertain, not gone, and deleting
  // here could give up a lease we still hold while the caller's critical section is running.
  // The callback is not awaited — after refresh_errors the declaring beat must return at once so
  // the next refresh is scheduled; a slow callback could let a lease that survived lapse.
  const declareLost = (reason: LockLostReason): void => {
    if (hasDeclaredLoss || hasReleased) return;
    hasDeclaredLoss = true;
    log.warn(`Lock lost: ${key}`, { reason });
    if (!onLockLost) return;
    try {
      void Promise.resolve(onLockLost(reason)).catch((err) =>
        log.error(`Lock onLockLost callback failed: ${key}`, err),
      );
    } catch (err) {
      log.error(`Lock onLockLost callback failed: ${key}`, err);
    }
  };

  // Only a thrown refresh spends the missed-beat budget, and exhausting it keeps refreshing — a
  // lease that survived a Redis blip is held until release. A `0` is a definitive token mismatch:
  // loss at once, and the heartbeat stops because there is nothing left to refresh.
  const tick = async () => {
    let renewed: unknown;
    try {
      renewed = await fencedRefresh(redis, key, processId, ttlMs);
    } catch (err) {
      missed += 1;
      log.warn(`Lock refresh failed: ${key}`, { missed }, err);
      if (missed > maxMissed) declareLost('refresh_errors');
      return;
    }
    if (renewed === 1) {
      missed = 0;
      return;
    }
    stopHeartbeat();
    declareLost('token_mismatch');
  };

  const acquire = async (): Promise<boolean> => {
    const result = await redis.set(key, processId, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return false;
    stop = heartbeat(tick, heartbeatMs, { onError: (err) => log.error(`Lock heartbeat error: ${key}`, err) });
    return true;
  };

  const verify = async (): Promise<boolean> => {
    if (hasDeclaredLoss || hasReleased) return false;
    const current = await redis.get(key);
    return current === processId;
  };

  // Always attempts the fenced delete, once, after the critical section — the only place the
  // key is ever deleted.
  const release = async (): Promise<LockReleaseResult> => {
    hasReleased = true;
    stopHeartbeat();
    return compareAndDelete();
  };

  return { acquire, verify, release };
};

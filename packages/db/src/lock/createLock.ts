/**
 * @atlas
 * @partOf infrastructure:prisma, infrastructure:redis
 * @uses none
 */
// Single-node Redis lock. Footguns:
//   - Not Redlock — do not rely across cluster nodes.
//   - Worker suspension > ttlMs (debugger pause, OS sleep) → key expires + another holder takes it
//     + we wake up thinking we hold it. Mitigation: ttlMs >> expected pause duration.
//   - verify() is point-in-time; the race between verify-returns-true and the next op
//     completing is microseconds but non-zero. For exactly-once semantics, fence at the resource.
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';
import { heartbeat } from '@template/shared/utils';
import type { Redis } from 'ioredis';

export type LockRedis = Pick<Redis, 'set' | 'get' | 'eval'>;
export type LockLostReason = 'token_mismatch' | 'refresh_errors';
export type LockReleaseResult = 'released' | 'notHeld' | 'unconfirmed';

// `redis` runs the lock on a caller-owned connection (the jobs queue's, not the shared cache
// client); `key` keeps a caller-owned key instead of `lock:<service>:<identifier>`.
export type LockOptions = ({ service: string; identifier: string } | { key: string }) & {
  redis?: LockRedis;
  ttlMs?: number;
  heartbeatMs?: number;
  maxMissed?: number;
  onLockLost?: (reason: LockLostReason) => void | Promise<void>;
};

export type Lock = {
  acquire: () => Promise<boolean>;
  verify: () => Promise<boolean>;
  release: () => Promise<LockReleaseResult>;
};

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

  // Fenced delete in one Lua eval so the key can't expire and be re-acquired between a separate
  // GET and DEL — an unfenced delete would then remove the new holder's lock (steal-and-cascade).
  const FENCED_DELETE =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
  // `unconfirmed`: the delete threw, but ioredis may still send it after a reconnect. The key is
  // freed if the delete still reaches Redis, otherwise at its TTL — say so, don't stay silent.
  const compareAndDelete = async (): Promise<LockReleaseResult> => {
    try {
      const result = await redis.eval(FENCED_DELETE, 1, key, processId);
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

  // Refresh is one compare-and-expire eval. A GET then a separate PEXPIRE lets a key that expired
  // and was re-acquired between the two calls be extended for its new holder.
  const FENCED_REFRESH =
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
  // Only a thrown refresh spends the missed-beat budget, and exhausting it keeps refreshing — a
  // lease that survived a Redis blip is held until release. A `0` is a definitive token mismatch:
  // loss at once, and the heartbeat stops because there is nothing left to refresh.
  const tick = async () => {
    let renewed: unknown;
    try {
      renewed = await redis.eval(FENCED_REFRESH, 1, key, processId, String(ttlMs));
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

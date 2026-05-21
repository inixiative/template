// Single-node Redis lock. Footguns:
//   - Not Redlock — do not rely across cluster nodes.
//   - Worker suspension > ttlMs (debugger pause, OS sleep) → key expires + another holder takes it
//     + we wake up thinking we hold it. Mitigation: ttlMs >> expected pause duration.
//   - verify() is point-in-time; the race between verify-returns-true and the next op
//     completing is microseconds but non-zero. For exactly-once semantics, fence at the resource.
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';

export type LockOptions = {
  service: string;
  identifier: string;
  ttlMs?: number;
  heartbeatMs?: number;
  maxMissed?: number;
  onLockLost?: () => void | Promise<void>;
};

export type Lock = {
  acquire: () => Promise<boolean>;
  verify: () => Promise<boolean>;
  release: () => Promise<void>;
};

export const createLock = (opts: LockOptions): Lock => {
  const { service, identifier, ttlMs = 30_000, heartbeatMs = 10_000, maxMissed = 1, onLockLost } = opts;

  if (maxMissed < 1) {
    throw new Error(`createLock: maxMissed must be >= 1, got ${maxMissed}`);
  }
  if ((maxMissed + 1) * heartbeatMs >= ttlMs) {
    throw new Error(
      `createLock: unsafe config — (maxMissed + 1) * heartbeatMs (${(maxMissed + 1) * heartbeatMs}ms) must be < ttlMs (${ttlMs}ms)`,
    );
  }

  const redis = getRedisClient();
  const key = `${redisNamespace.lock}:${service}:${identifier}`;
  const processId = crypto.randomUUID();
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let missed = 0;
  let declared = false;

  const stopHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  };

  const compareAndDelete = async () => {
    const current = await redis.get(key);
    if (current === processId) await redis.del(key);
  };

  const declareLost = async () => {
    if (declared) return;
    declared = true;
    stopHeartbeat();
    log.warn(`Lock lost: ${key}`);
    if (onLockLost) await onLockLost();
    await compareAndDelete();
  };

  const tick = async () => {
    const current = await redis.get(key).catch(() => null);
    if (current === processId) {
      await redis.pexpire(key, ttlMs).catch(() => null);
      missed = 0;
      return;
    }
    missed += 1;
    if (missed > maxMissed) await declareLost();
  };

  const acquire = async (): Promise<boolean> => {
    const result = await redis.set(key, processId, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return false;
    heartbeat = setInterval(() => {
      tick().catch((err) => log.error(`Lock heartbeat error: ${key}`, err));
    }, heartbeatMs);
    return true;
  };

  const verify = async (): Promise<boolean> => {
    if (declared) return false;
    const current = await redis.get(key);
    return current === processId;
  };

  const release = async (): Promise<void> => {
    if (declared) {
      stopHeartbeat();
      return;
    }
    declared = true;
    stopHeartbeat();
    await compareAndDelete();
  };

  return { acquire, verify, release };
};

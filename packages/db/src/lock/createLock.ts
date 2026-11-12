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
import { lockKeysOf } from '@template/db/lock/lockKeysOf';
import { LockLostError } from '@template/db/lock/lockLostError';
import { TOLERATED_REFRESH_FAILURES } from '@template/db/lock/maxSafeHeartbeatMs';
import { fencedDelete } from '@template/db/lock/queries/fencedDelete';
import { fencedDeleteAll } from '@template/db/lock/queries/fencedDeleteAll';
import { fencedRefresh } from '@template/db/lock/queries/fencedRefresh';
import { fencedRefreshAll } from '@template/db/lock/queries/fencedRefreshAll';
import { fencedSetPrefix } from '@template/db/lock/queries/fencedSetPrefix';
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
import { uuidv7 } from 'uuidv7';

const DEFAULT_POLL_MS = 50;
const FIRST_POLL_MS = 1;
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function createLock(opts: ClaimOptions): Claim;
export function createLock(opts: LockOptions): Lock;
export function createLock(opts: LockOptions | ClaimOptions): Lock | Claim {
  const redisClient = opts.redis ?? getRedisClient();
  if (opts.heartbeat === false) return createClaim(opts, redisClient, lockKeyOf(opts));
  return createRenewingLock(opts, redisClient, lockKeysOf(opts));
}

// A lock on one key runs SET NX PX to acquire, fencedRefresh to beat and fencedDelete to release.
// A lock on several keys runs one command per step over the whole set: fencedSetPrefix per poll,
// fencedRefreshAll per beat, fencedDeleteAll to release.
const createRenewingLock = (
  opts: LockOptions,
  redis: LockRedis,
  keys: [string, ...string[]],
): Lock => {
  const { ttlMs = 30_000, heartbeatMs = 10_000, onLockLost } = opts;

  if (heartbeatMs <= 0) {
    throw new Error(`createLock: heartbeatMs must be > 0, got ${heartbeatMs}`);
  }
  if ((TOLERATED_REFRESH_FAILURES + 1) * heartbeatMs >= ttlMs) {
    throw new Error(
      `createLock: unsafe config — heartbeatMs ${heartbeatMs}ms must leave room for one failed refresh before ttlMs ${ttlMs}ms`,
    );
  }

  const [firstKey] = keys;
  const isSet = keys.length > 1;
  // A set is labelled in logs and errors by its first key plus the count of the rest.
  const key = isSet ? `${firstKey} (+${keys.length - 1})` : firstKey;
  const processId = uuidv7();
  let stop: (() => void) | null = null;
  let hasReleased = false;
  let hasAcquired = false;
  let hasObservedMismatch = false;
  let hasReportedLoss = false;
  let hasLostLease = false;
  let leaseValidUntil = 0;
  let releasePromise: Promise<LockReleaseResult> | null = null;
  // The keys of a set this lock still holds, and how many of `keys` (in order) it has won.
  let held: string[] = [];
  let wonCount = 0;

  const stopHeartbeat = () => {
    stop?.();
    stop = null;
  };

  // A set reports released only when the delete removed every key; the keys still held are deleted
  // all the same.
  const deleteKeys = async (): Promise<boolean> =>
    isSet
      ? (await fencedDeleteAll(redis, keys, processId)) === keys.length
      : fencedDelete(redis, firstKey, processId);

  const compareAndDelete = async (): Promise<LockReleaseResult> => {
    try {
      return (await deleteKeys()) ? 'released' : 'notHeld';
    } catch (err) {
      log.error(
        `Lock fenced delete unconfirmed; the key is freed if the delete still reaches Redis, otherwise at its TTL: ${key}`,
        err,
      );
      return 'unconfirmed';
    }
  };

  const declareLost = (): void => {
    if (hasReportedLoss || hasReleased) return;
    hasReportedLoss = true;
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

  const tickOne = async () => {
    let renewed: boolean;
    const sentAt = performance.now();
    try {
      renewed = await fencedRefresh(redis, firstKey, processId, ttlMs);
    } catch (err) {
      log.warn(`Lock refresh failed: ${key}`, err);
      return;
    }
    if (renewed) {
      leaseValidUntil = sentAt + ttlMs;
      return;
    }
    hasObservedMismatch = true;
    stopHeartbeat();
    declareLost();
  };

  // A key of a set that expired, was evicted or was taken over is dropped; the beat carries on for
  // the rest and stops only when none is left.
  const tickSet = async () => {
    const beating = [...held];
    if (beating.length === 0) return;
    let refreshed: boolean[];
    const sentAt = performance.now();
    try {
      refreshed = await fencedRefreshAll(redis, beating, processId, ttlMs);
    } catch (err) {
      log.warn(`Lock refresh failed: ${key}`, err);
      return;
    }
    leaseValidUntil = sentAt + ttlMs;
    const lost = new Set(beating.filter((_, index) => !refreshed[index]));
    if (lost.size === 0) return;
    held = held.filter((heldKey) => !lost.has(heldKey));
    hasObservedMismatch = true;
    log.warn(`Lock keys lost: ${key} (${lost.size} lost, ${held.length} still held)`);
    if (held.length === 0) stopHeartbeat();
    declareLost();
  };

  const startHeartbeat = (): void => {
    stop = heartbeat(isSet ? tickSet : tickOne, heartbeatMs, {
      onError: (err) => log.error(`Lock heartbeat error: ${key}`, err),
    });
  };

  const tryAcquireOne = async (): Promise<boolean> => {
    const sentAt = performance.now();
    const result = await redis.set(firstKey, processId, 'PX', ttlMs, 'NX');
    if (result !== 'OK') return false;
    if (hasReleased) {
      await compareAndDelete();
      return false;
    }
    hasAcquired = true;
    leaseValidUntil = sentAt + ttlMs;
    startHeartbeat();
    return true;
  };

  // Progress is key by key in sorted order: each poll takes the longest run of free keys after the
  // ones already won and keeps them, so the set never needs every key free at the same moment. The
  // heartbeat starts with the first key won. A key won and then lost while waiting on a later one
  // gives the whole set back, and the next poll starts again from the first key.
  const tryAcquireSet = async (): Promise<boolean> => {
    const remaining = keys.slice(wonCount);
    const sentAt = performance.now();
    const won = await fencedSetPrefix(redis, remaining, processId, ttlMs);
    if (hasReleased) {
      await compareAndDelete();
      return false;
    }
    if (won > 0) {
      held.push(...remaining.slice(0, won));
      wonCount += won;
      if (!stop) {
        leaseValidUntil = sentAt + ttlMs;
        startHeartbeat();
      }
    }
    if (held.length < wonCount) {
      await giveBackWon();
      return false;
    }
    if (wonCount < keys.length) return false;
    hasAcquired = true;
    return true;
  };

  const tryAcquire = (): Promise<boolean> => {
    if (hasReleased) {
      throw new Error('createLock: this lock was released; create a new lock to acquire again');
    }
    return isSet ? tryAcquireSet() : tryAcquireOne();
  };

  // An acquire that ends false, by timeout or error, holds none of a set's keys.
  const giveBackWon = async (): Promise<void> => {
    if (!isSet || wonCount === 0) return;
    stopHeartbeat();
    held = [];
    wonCount = 0;
    hasObservedMismatch = false;
    hasReportedLoss = false;
    leaseValidUntil = 0;
    try {
      await deleteKeys();
    } catch (err) {
      log.error(`Lock give-back unconfirmed; the keys won are freed at their TTL: ${key}`, err);
    }
  };

  const acquire = async ({
    waitMs = 0,
    pollMs = DEFAULT_POLL_MS,
    onTimeout,
  }: AcquireOptions = {}): Promise<boolean> => {
    const deadline = Date.now() + waitMs;
    let pause = Math.min(FIRST_POLL_MS, pollMs);
    try {
      while (!(await tryAcquire())) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          await giveBackWon();
          if (onTimeout) throw onTimeout();
          return false;
        }
        await sleep(Math.min(pause, remaining));
        pause = Math.min(pause * 2, pollMs);
      }
    } catch (err) {
      await giveBackWon();
      throw err;
    }
    return true;
  };

  // Answers from Redis: true only while every key holds this token. There is no local loss latch
  // before release, so ownership that came back is reported from the current Redis state.
  const verify = async (): Promise<boolean> => {
    if (hasReleased) return false;
    const current = await Promise.all(keys.map((lockKey) => redis.get(lockKey)));
    return current.every((token) => token === processId);
  };

  const isWithinLease = (): boolean => {
    if (!hasAcquired || hasLostLease) return false;
    if (hasReleased || hasObservedMismatch || performance.now() >= leaseValidUntil) {
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

  return { holder: processId, acquire, verify, release, isWithinLease, assertHeld };
};

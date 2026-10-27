/**
 * @atlas
 * @kind constructor
 * @partOf primitive:caching, infrastructure:redis, mutex
 * @uses none
 */
import { createLock } from '@template/db/lock/createLock';
import { lockKeyOf } from '@template/db/lock/lockKeyOf';

// A short heartbeat-renewed lease: a holder killed mid-compute (a redeploy) frees its waiters when
// the lease lapses rather than stranding them for a slowest-producer TTL.
const SINGLE_FLIGHT_LOCK_TTL_MS = 2_000;
const SINGLE_FLIGHT_HEARTBEAT_MS = 500;

const SINGLE_FLIGHT_SERVICE = 'cache-singleflight';

// The per-key lock `cache` takes while it computes a miss. It is also the cache-wide marker for "a
// compute of this key is running": a rolling cache's refresh holds the same lock, and `checkCache`
// reads its key to report computing.
export const singleFlightLock = (key: string) =>
  createLock({
    service: SINGLE_FLIGHT_SERVICE,
    identifier: key,
    ttlMs: SINGLE_FLIGHT_LOCK_TTL_MS,
    heartbeatMs: SINGLE_FLIGHT_HEARTBEAT_MS,
    maxMissed: 1,
  });

export const singleFlightLockKey = (key: string): string =>
  lockKeyOf({ service: SINGLE_FLIGHT_SERVICE, identifier: key });

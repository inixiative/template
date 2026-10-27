/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis, mutex
 * @uses infrastructure:observability
 */
import type { singleFlightLock } from '@template/db/lock/singleFlight/singleFlightLock';
import { readCached } from '@template/db/redis/cache/readCached';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import type { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { recordDuration } from '@template/shared/telemetry';

const SINGLE_FLIGHT_POLL_MS = 50;
// Longer than the slowest known producer, so a waiter almost never duplicates the work.
const SINGLE_FLIGHT_MAX_WAIT_MS = 20_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type SingleFlight<T> =
  | { result: 'hit'; value: T }
  | { result: 'settled'; holdsLock: boolean; lockUnavailable: boolean };

// The first miss takes the key's lock and computes; the rest poll for the value it will write. The
// poll reads the cache between attempts, which `acquire({ waitMs })` cannot, so the loop is here.
// When the lease lapses with no value written, a waiter re-acquires so exactly one recomputes rather
// than every waiter stampeding the producer. Every failure falls through to computing: a lock we
// cannot take, a holder that dies, or a producer slower than the wait. The wait is timed into
// `cache.lock.wait` by accessor.
export const acquireSingleFlight = async <T>(
  redis: ReturnType<typeof getRedisClient>,
  key: string,
  lock: ReturnType<typeof singleFlightLock>,
  setResult: (result: CacheResult) => void,
): Promise<SingleFlight<T>> => {
  let holdsLock = false;
  let lockUnavailable = false;
  try {
    holdsLock = await lock.acquire();
  } catch (error) {
    lockUnavailable = true;
    log.error(`Cache lock error for key ${key}:`, error);
  }

  if (!holdsLock && !lockUnavailable) {
    const waitStarted = performance.now();
    const deadline = Date.now() + SINGLE_FLIGHT_MAX_WAIT_MS;
    try {
      while (Date.now() < deadline) {
        await sleep(SINGLE_FLIGHT_POLL_MS);
        const polled = await readCached<T>(redis, key);
        if (polled.result === 'hit') {
          setResult('hit');
          return { result: 'hit', value: polled.value };
        }
        if (polled.result === 'error') setResult('error');
        try {
          holdsLock = await lock.acquire();
        } catch (error) {
          lockUnavailable = true;
          log.error(`Cache lock error for key ${key}:`, error);
          break;
        }
        if (holdsLock) break;
      }
    } finally {
      recordDuration('cache.lock.wait', (performance.now() - waitStarted) / 1000, {
        accessor: cacheAccessor(key),
      });
    }
  }

  return { result: 'settled', holdsLock, lockUnavailable };
};

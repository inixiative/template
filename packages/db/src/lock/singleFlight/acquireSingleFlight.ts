/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis, mutex
 * @uses infrastructure:observability
 */
import type { singleFlightLock } from '@template/db/lock/singleFlight/singleFlightLock';
import { fetchCachedValue } from '@template/db/redis/cache/fetchCachedValue';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import type { redisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { recordDuration } from '@template/shared/telemetry';

const SINGLE_FLIGHT_POLL_MS = 50;
const SINGLE_FLIGHT_MAX_WAIT_MS = 10_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type SingleFlight<T> = { result: 'hit'; value: T } | { result: 'miss'; holdsLock: boolean };

export const acquireSingleFlight = async <T>(
  redis: ReturnType<typeof redisClient>,
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
        const polled = await fetchCachedValue<T>(redis, key);
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

  return { result: 'miss', holdsLock };
};

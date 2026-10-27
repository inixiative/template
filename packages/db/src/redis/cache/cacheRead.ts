/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { acquireSingleFlight } from '@template/db/lock/singleFlight/acquireSingleFlight';
import { singleFlightLock } from '@template/db/lock/singleFlight/singleFlightLock';
import { readGeneration } from '@template/db/redis/cache/generation/readGeneration';
import { publishComputed } from '@template/db/redis/cache/publishComputed';
import { readCached } from '@template/db/redis/cache/readCached';
import { resolveTtl } from '@template/db/redis/cache/resolveTtl';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import superjson from 'superjson';

// The generation is captured after the lock and before the producer, so a clear that lands while
// the producer reads cancels its publish. Without the lock or the generation the value is returned
// unpublished: nothing can prove a clear did not run meanwhile.
export const cacheRead = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number),
  shouldKeepExisting: boolean,
  setResult: (result: CacheResult) => void,
): Promise<T> => {
  const redis = getRedisClient();

  const cached = await readCached<T>(redis, key);
  setResult(cached.result);
  if (cached.result === 'hit') return cached.value;

  const lock = singleFlightLock(key);
  const flight = await acquireSingleFlight<T>(redis, key, lock, setResult);
  if (flight.result === 'hit') return flight.value;
  const { holdsLock, lockUnavailable } = flight;

  try {
    const generation = lockUnavailable ? null : await readGeneration(redis, key);
    const value = await fn();
    const effectiveTtl = resolveTtl(value, ttl);

    if (effectiveTtl > 0 && generation) {
      const payload = superjson.stringify(value);
      const write = publishComputed(
        redis,
        key,
        generation,
        effectiveTtl,
        payload,
        shouldKeepExisting,
      );
      // Awaited only while holding the lock: waiters poll the value key, so releasing before the
      // write lands would send every one of them off to recompute.
      if (holdsLock) await write;
    }

    return value;
  } finally {
    if (holdsLock) {
      await lock.release().catch((error) => {
        log.error(`Cache lock release error for key ${key}:`, error);
      });
    }
  }
};

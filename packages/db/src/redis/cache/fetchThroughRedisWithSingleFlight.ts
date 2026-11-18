/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { acquireSingleFlight } from '@template/db/lock/singleFlight/acquireSingleFlight';
import { singleFlightLock } from '@template/db/lock/singleFlight/singleFlightLock';
import { fetchCachedValue } from '@template/db/redis/cache/fetchCachedValue';
import { fetchCacheGeneration } from '@template/db/redis/cache/generation/fetchCacheGeneration';
import { publishComputed } from '@template/db/redis/cache/publishComputed';
import { resolveTtl } from '@template/db/redis/cache/resolveTtl';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { redisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import superjson from 'superjson';

export const fetchThroughRedisWithSingleFlight = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number),
  setResult: (result: CacheResult) => void,
): Promise<T> => {
  const redis = redisClient();

  const cached = await fetchCachedValue<T>(redis, key);
  setResult(cached.result);
  if (cached.result === 'hit') return cached.value;

  const lock = singleFlightLock(key);
  const flight = await acquireSingleFlight<T>(redis, key, lock, setResult);
  if (flight.result === 'hit') return flight.value;
  const { holdsLock } = flight;

  try {
    const generation = holdsLock ? await fetchCacheGeneration(redis, key) : null;
    const value = await fn();
    const effectiveTtl = resolveTtl(value, ttl);

    if (effectiveTtl > 0 && generation !== null)
      await publishComputed(
        redis,
        key,
        generation,
        lock.holder,
        effectiveTtl,
        superjson.stringify(value),
      );

    return value;
  } finally {
    if (holdsLock) {
      await lock.release().catch((error) => {
        log.error(`Cache lock release error for key ${key}:`, error);
      });
    }
  }
};

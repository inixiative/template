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

export const readThrough = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number),
  setResult: (result: CacheResult) => void,
): Promise<T> => {
  const redis = getRedisClient();

  const cached = await readCached<T>(redis, key);
  setResult(cached.result);
  if (cached.result === 'hit') return cached.value;

  const lock = singleFlightLock(key);
  const flight = await acquireSingleFlight<T>(redis, key, lock, setResult);
  if (flight.result === 'hit') return flight.value;
  const { holdsLock } = flight;

  try {
    const generation = holdsLock ? await readGeneration(redis, key) : null;
    const value = await fn();
    const effectiveTtl = resolveTtl(value, ttl);

    if (effectiveTtl > 0 && generation !== null && lock.isWithinLease())
      await publishComputed(redis, key, generation, effectiveTtl, superjson.stringify(value));

    return value;
  } finally {
    if (holdsLock) {
      await lock.release().catch((error) => {
        log.error(`Cache lock release error for key ${key}:`, error);
      });
    }
  }
};

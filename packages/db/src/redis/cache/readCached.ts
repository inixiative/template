/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import superjson from 'superjson';

type CacheRead<T> = { result: 'hit'; value: T } | { result: 'miss' | 'error' };

// superjson round-trips Date/BigInt/Map/Set; entries written before superjson (plain JSON)
// deserialize to undefined and read as a miss. A Redis failure reads as `error`, and the caller
// computes without the cache.
export const readCached = async <T>(
  redis: ReturnType<typeof getRedisClient>,
  key: string,
): Promise<CacheRead<T>> => {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      const value = superjson.parse<T>(cached);
      if (value !== undefined) return { result: 'hit', value };
    }
  } catch (error) {
    log.error(`Cache read error for key ${key}:`, error);
    return { result: 'error' };
  }
  return { result: 'miss' };
};

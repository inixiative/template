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

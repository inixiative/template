/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { epochKey } from '@template/db/redis/cache/generation/epochKey';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import {
  GENERATION_TTL_SECONDS,
  newGeneration,
} from '@template/db/redis/cache/generation/newGeneration';
import { clearCacheEntry } from '@template/db/redis/cache/queries/clearCacheEntry';
import { clearExact } from '@template/db/redis/cache/queries/clearExact';
import { validateKey } from '@template/db/redis/cache/validateKey';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';

export const clearKey = async (
  pattern: string,
  { cancelInFlight = true }: { cancelInFlight?: boolean } = {},
): Promise<number> => {
  validateKey(pattern);
  const isPattern = pattern.includes('*');

  try {
    const redis = getRedisClient();

    if (!isPattern) {
      const keys = { key: pattern, writtenKey: writtenKey(pattern) };
      const deleted = cancelInFlight
        ? await clearExact(
            redis,
            { ...keys, generationKey: generationKey(pattern) },
            newGeneration(),
            GENERATION_TTL_SECONDS,
          )
        : await clearCacheEntry(redis, keys);
      if (deleted) log.debug(`Cleared cache key: ${pattern}`);
      return deleted;
    }

    if (cancelInFlight) {
      await redis.set(epochKey(), newGeneration(), 'EX', GENERATION_TTL_SECONDS);
    }
    let deleted = 0;
    const stream = redis.scanStream({ match: pattern, count: 100 });

    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    }

    if (deleted > 0) log.debug(`Cleared ${deleted} cache entries for pattern: ${pattern}`);
    return deleted;
  } catch (error) {
    log.error(`Failed to clear cache for pattern ${pattern}:`, error);
    if (isPattern) throw error;
    return 0;
  }
};

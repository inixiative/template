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

// A clear also cancels computes in flight: an exact clear moves the key's generation, a pattern clear
// moves the cache-wide epoch before it scans, and a compute that read before either skips its
// publish. `cancelInFlight: false` only evicts, so overlapping clears of a hot key share one
// recompute. A failed exact clear logs and returns 0; a failed pattern clear throws, because the
// caller cannot tell which of its keys survived.
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
    // SCAN, not KEYS: non-blocking.
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

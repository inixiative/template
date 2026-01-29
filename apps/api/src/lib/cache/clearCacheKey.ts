import { getRedisClient } from '#/lib/clients/redis';
import { log } from '@template/shared/logger';

/**
 * Clear cache entries matching a pattern.
 * Supports wildcards (*) for pattern matching.
 * Uses SCAN instead of KEYS to avoid blocking Redis.
 *
 * Note: Keys should already include the cache: prefix (use cacheKey() to build them).
 *
 * @example
 * await clearCacheKey('cache:User:id:123');        // Exact key
 * await clearCacheKey('cache:User:*');             // Pattern with wildcard
 * await clearCacheKey('cache:*');                  // All cache entries
 */
export const clearCacheKey = async (pattern: string): Promise<number> => {
  const key = pattern;

  try {
    const redis = getRedisClient();

    // No wildcard = exact key, just delete directly
    if (!key.includes('*')) {
      const deleted = await redis.del(key);
      if (deleted) log.debug(`Cleared cache key: ${key}`);
      return deleted;
    }

    // Use SCAN for patterns (non-blocking, unlike KEYS)
    let deleted = 0;
    const stream = redis.scanStream({ match: key, count: 100 });

    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    }

    if (deleted > 0) log.debug(`Cleared ${deleted} cache entries for pattern: ${key}`);
    return deleted;
  } catch (error) {
    log.error(`Failed to clear cache for pattern ${key}:`, error);
    return 0;
  }
};

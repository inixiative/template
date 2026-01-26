import { env } from '#/config/env';
import { getRedisClient } from '#/lib/clients/redis';
import { log } from '#/lib/logger';

/**
 * Clear cache entries matching a pattern.
 * Supports wildcards (*) for pattern matching.
 * Uses SCAN instead of KEYS to avoid blocking Redis.
 *
 * @example
 * await clearCacheKey('users:123');           // Exact key
 * await clearCacheKey('users:123:*');         // Pattern with wildcard
 * await clearCacheKey('pools:slug:ranch-*');  // Pattern matching
 */
export async function clearCacheKey(pattern: string): Promise<number> {
  if (env.isTest) {
    pattern = `test:${pattern}`;
  }

  try {
    const redis = await getRedisClient();

    // No wildcard = exact key, just delete directly
    if (!pattern.includes('*')) {
      const deleted = await redis.del(pattern);
      if (deleted && !env.isTest) {
        log.info(`Cleared cache key: ${pattern}`);
      }
      return deleted;
    }

    // Use SCAN for patterns (non-blocking, unlike KEYS)
    let deleted = 0;
    const stream = redis.scanStream({ match: pattern, count: 100 });

    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    }

    if (deleted > 0 && !env.isTest) {
      log.info(`Cleared ${deleted} cache entries for pattern: ${pattern}`);
    }

    return deleted;
  } catch (error) {
    log.error(`Failed to clear cache for pattern ${pattern}:`, error);
    return 0;
  }
}

import { env } from '@src/config/env';
import { getRedisClient } from '@src/lib/clients/redis';

/**
 * Clear cache entries matching a pattern.
 * Supports wildcards (*) for pattern matching.
 *
 * @example
 * await clearCacheKey('users:123');           // Exact key
 * await clearCacheKey('users:123:*');         // Pattern with wildcard
 * await clearCacheKey('pools:slug:ranch-*');  // Pattern matching
 */
export async function clearCacheKey(pattern: string): Promise<number> {
  // Prefix test keys for isolation
  if (env.isTest) {
    pattern = `test:${pattern}`;
  }

  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);

      if (!env.isTest) {
        console.log(`🗑️  Cleared ${keys.length} cache entries for pattern: ${pattern}`);
      }
    }

    return keys.length;
  } catch (error) {
    // Don't fail the request if cache clearing fails
    console.error(`Failed to clear cache for pattern ${pattern}:`, error);
    return 0;
  }
}

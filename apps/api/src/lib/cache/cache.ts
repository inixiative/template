import { compact } from 'lodash-es';
import { isTest } from '#/config/env';
import { getRedisClient } from '#/lib/clients/redis';
import { redisNamespace } from '#/lib/clients/redisNamespaces';
import { log } from '#/lib/logger';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours

/**
 * Build a cache key following the standard pattern.
 *
 * @example
 * cacheKey('User', 'abc-123')                              // cache:User:id:abc-123
 * cacheKey('User', 'foo@example.com', 'email')             // cache:User:email:foo@example.com
 * cacheKey('User', 'abc-123', 'id', ['OrganizationUsers']) // cache:User:id:abc-123:OrganizationUsers
 * cacheKey('Session', 'abc-123', 'userId', [], true)       // cache:Session:userId:abc-123:*
 */
export function cacheKey(model: string, value: string, field = 'id', tags: string[] = [], wildcard = false): string {
  const prefix = isTest ? `${redisNamespace.cache}:test` : redisNamespace.cache;
  return compact([prefix, model, field, value, ...tags, wildcard && '*']).join(':');
}

function validateKey(key: string): void {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
}

/**
 * Get value from cache, or compute and store it.
 * Always sets with TTL (default 24 hours) to ensure expiry.
 *
 * - Returns cached value if exists (including cached null)
 * - Computes via fn() on cache miss
 * - Caches null (prevents repeated lookups for missing records)
 * - Never caches undefined (return undefined from fn to skip caching)
 *
 * @example
 * ```ts
 * const user = await cache(`user:${id}`, async () => {
 *   return db.user.findUnique({ where: { id } }); // null cached if not found
 * });
 *
 * // With custom TTL (1 hour)
 * const stats = await cache(`stats:daily`, fetchStats, 60 * 60);
 * ```
 */
export async function cache<T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  validateKey(key);

  try {
    const redis = getRedisClient();
    const cached = await redis.get(key);

    // Cache hit (including cached null)
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    // Cache miss - compute value
    const value = await fn();

    // Cache everything except undefined
    if (value !== undefined) {
      await redis.setex(key, ttl, JSON.stringify(value));
    }

    return value;
  } catch (error) {
    log.error(`Cache error for key ${key}:`, error);
    // Fallback to computing without cache
    return fn();
  }
}

/**
 * Delete a key from cache (for invalidation).
 */
export async function deleteCache(key: string): Promise<void> {
  validateKey(key);

  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch (error) {
    log.error(`Cache delete failed for key ${key}:`, error);
  }
}

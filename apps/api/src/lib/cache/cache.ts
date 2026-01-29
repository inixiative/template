import { compact, isNil } from 'lodash-es';
import { getRedisClient } from '#/lib/clients/redis';
import { redisNamespace } from '#/lib/clients/redisNamespaces';
import { log } from '@template/shared/logger';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours
const NEGATIVE_TTL = 60; // 1 minute for null/undefined results

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
  return compact([redisNamespace.cache, model, field, value, ...tags, wildcard && '*']).join(':');
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
 * - Returns cached value if exists (including cached null/undefined)
 * - Computes via fn() on cache miss
 * - Caches null/undefined with short TTL (1 min) to prevent thundering herd
 * - Caches real values with provided TTL (default 24 hours)
 *
 * @example
 * ```ts
 * const user = await cache(cacheKey('User', id), async () => {
 *   return db.user.findUnique({ where: { id } });
 * });
 *
 * // With custom TTL (1 hour)
 * const stats = await cache(cacheKey('Stats', 'daily'), fetchStats, 60 * 60);
 * ```
 */
export async function cache<T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  validateKey(key);

  const redis = getRedisClient();

  // Try to get from cache
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch (error) {
    log.error(`Cache read error for key ${key}:`, error);
    // Redis down - fall through to compute without cache
  }

  // Cache miss or Redis error - compute value
  const value = await fn();

  // Cache the result (fire-and-forget on error)
  // Use short TTL for null/undefined to allow quick discovery of newly created records
  const effectiveTtl = isNil(value) ? NEGATIVE_TTL : ttl;
  redis.setex(key, effectiveTtl, JSON.stringify(value)).catch((error) => {
    log.error(`Cache write error for key ${key}:`, error);
  });

  return value;
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

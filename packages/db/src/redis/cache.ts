import { compact, isNil } from 'lodash-es';
import { log } from '@template/shared/logger';
import { getRedisClient } from './client';
import { redisNamespace } from './namespaces';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours
const NEGATIVE_TTL = 60; // 1 minute for null/undefined results

type Identifier = string | Record<string, string>;

// ISO 8601 date regex for reviver
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

function dateReviver(_key: string, value: any): any {
  if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
}

/**
 * Build a cache key. Composite keys are sorted alphabetically for consistency.
 *
 * @example
 * cacheKey('user', 'abc-123')                                        // cache:user:id:abc-123
 * cacheKey('user', { email: 'foo@example.com' })                     // cache:user:email:foo@example.com
 * cacheKey('organizationUser', { userId: 'u1', organizationId: 'o1' })
 *   // → cache:organizationUser:organizationId:o1:userId:u1 (sorted)
 * cacheKey('user', 'abc-123', ['organizationUsers'])                 // cache:user:id:abc-123:organizationUsers
 * cacheKey('session', { userId: 'abc-123' }, [], true)               // cache:session:userId:abc-123:*
 */
export function cacheKey(accessor: string, identifier: Identifier, tags: string[] = [], wildcard = false): string {
  const idParts: string[] = [];

  if (typeof identifier === 'string') {
    idParts.push('id', identifier);
  } else {
    // Sort alphabetically by field name for consistent composite keys
    const pairs = Object.entries(identifier).sort(([a], [b]) => a.localeCompare(b));
    for (const [field, value] of pairs) {
      idParts.push(field, value);
    }
  }

  return compact([redisNamespace.cache, accessor, ...idParts, ...tags, wildcard && '*']).join(':');
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
 * const user = await cache(cacheKey('user', id), async () => {
 *   return db.user.findUnique({ where: { id } });
 * });
 *
 * // With custom TTL (1 hour)
 * const stats = await cache(cacheKey('stats', 'daily'), fetchStats, 60 * 60);
 * ```
 */
export async function cache<T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  validateKey(key);

  const redis = getRedisClient();

  // Try to get from cache
  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached, dateReviver) as T;
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

export async function upsertCache<T>(
  key: string,
  value: T,
  options: { ttl?: number; force?: boolean } = {},
): Promise<boolean> {
  const { ttl = DEFAULT_TTL, force = false } = options;
  validateKey(key);

  try {
    const redis = getRedisClient();
    if (!force && (await redis.exists(key))) return false;
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear cache entries matching a pattern.
 * Supports wildcards (*) for pattern matching.
 * Uses SCAN instead of KEYS to avoid blocking Redis.
 *
 * @example
 * await clearKey('cache:User:id:123');        // Exact key
 * await clearKey('cache:User:*');             // Pattern with wildcard
 * await clearKey('cache:*');                  // All cache entries
 */
export async function clearKey(pattern: string): Promise<number> {
  validateKey(pattern);

  try {
    const redis = getRedisClient();

    // No wildcard = exact key, just delete directly
    if (!pattern.includes('*')) {
      const deleted = await redis.del(pattern);
      if (deleted) log.debug(`Cleared cache key: ${pattern}`);
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

    if (deleted > 0) log.debug(`Cleared ${deleted} cache entries for pattern: ${pattern}`);
    return deleted;
  } catch (error) {
    log.error(`Failed to clear cache for pattern ${pattern}:`, error);
    return 0;
  }
}

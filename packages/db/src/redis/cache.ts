/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses none
 */
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { type AccessorName, type ModelName, isModelName, toAccessor } from '@template/db/utils/modelNames';
import { log } from '@template/shared/logger';
import { compact, isNil } from 'lodash-es';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours
const NEGATIVE_TTL = 60; // 1 minute for null/undefined results

type Identifier = string | Record<string, string>;

// ISO 8601 date regex for reviver
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

const dateReviver = (_key: string, value: unknown): unknown => {
  if (typeof value === 'string' && ISO_DATE_REGEX.test(value)) {
    return new Date(value);
  }
  return value;
};

// A key segment is a model or accessor name (normalized to the accessor, since
// Redis is case-sensitive and write/clear keys must agree) or any other string.
type CacheSegment = AccessorName | ModelName | (string & {});

const toCacheSegment = (segment: CacheSegment): string => (isModelName(segment) ? toAccessor(segment) : segment);

export const cacheKey = (domain: CacheSegment, identifier: Identifier, tags: CacheSegment[] = [], wildcard = false): string => {
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

  return compact([redisNamespace.cache, toCacheSegment(domain), ...idParts, ...tags.map(toCacheSegment), wildcard && '*']).join(':');
};

const validateKey = (key: string): void => {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
};

// In-process single-flight: concurrent callers missing the same key co-resolve
// off one compute (per-process; no distributed lock).
const __inFlight = new Map<string, Promise<unknown>>();

export const cache = async <T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> => {
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

  // Collapse concurrent misses on the same key onto one in-flight compute.
  const pending = __inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const compute = (async (): Promise<T> => {
    const value = await fn();

    // Cache the result (fire-and-forget on error)
    // Use short TTL for null/undefined to allow quick discovery of newly created records
    const effectiveTtl = isNil(value) ? NEGATIVE_TTL : ttl;
    redis.setex(key, effectiveTtl, JSON.stringify(value)).catch((error) => {
      log.error(`Cache write error for key ${key}:`, error);
    });

    return value;
  })();

  __inFlight.set(key, compute);
  try {
    return await compute;
  } finally {
    __inFlight.delete(key);
  }
};

export const upsertCache = async <T>(
  key: string,
  value: T,
  options: { ttl?: number; force?: boolean } = {},
): Promise<boolean> => {
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
};

export const clearKey = async (pattern: string): Promise<number> => {
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
};

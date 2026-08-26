/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses none
 */
import { randomUUID } from 'node:crypto';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';
import { type AccessorName, isModelName, type ModelName, toAccessor } from '@template/db/utils/modelNames';
import { log } from '@template/shared/logger';
import { compact, isNil } from 'lodash-es';
import superjson from 'superjson';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours
const NEGATIVE_TTL = 60; // 1 minute for null/undefined results

type Identifier = string | Record<string, string>;

// The domain is a model or accessor name; normalize it to the accessor so a write
// keyed 'User' and a clear keyed 'user' agree (Redis is case-sensitive). Tags are
// opaque grouping labels — used verbatim, never model-normalized.
type CacheDomain = AccessorName | ModelName | (string & {});

const toAccessorName = (domain: CacheDomain): string => (isModelName(domain) ? toAccessor(domain) : domain);

export const cacheKey = (
  domain: CacheDomain,
  identifier: Identifier,
  tags: string[] = [],
  wildcard = false,
): string => {
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

  return compact([redisNamespace.cache, toAccessorName(domain), ...idParts, ...tags, wildcard && '*']).join(':');
};

const validateKey = (key: string): void => {
  if (key.includes('undefined')) {
    throw new Error(`Cache key contains 'undefined': ${key}`);
  }
};

const resolveTtl = <T>(value: T, ttl: number | ((value: T) => number)): number => {
  if (isNil(value)) return NEGATIVE_TTL;
  return typeof ttl === 'function' ? ttl(value) : ttl;
};

// Concurrent misses on one key each ran `fn`, so an expensive producer was paid for once per
// caller — and the lock is in Redis, so the flight is single across instances, not just within
// one process. The first miss takes a short lock and computes; the rest wait for the value to
// appear.
//
// Every failure mode falls through to computing rather than erroring — a lock we cannot take,
// a holder that dies, or a producer slower than the wait all degrade to computing ourselves.
//
// The lock is a short lease the holder renews while its producer runs, not a lifetime sized for
// the slowest producer. A holder killed mid-compute (a redeploy) never runs its release, and
// every waiter sits behind its lock until the lease lapses — so the lease, not the wait, is what
// bounds an orphan. A live holder renews well inside the lease; a lapse under an event-loop stall
// merely lets one waiter compute alongside.
const SINGLE_FLIGHT_LOCK_TTL_MS = 2_000;
const SINGLE_FLIGHT_HEARTBEAT_MS = 500;
const SINGLE_FLIGHT_POLL_MS = 50;
// Longer than the slowest known producer, so a waiter almost never duplicates the work.
const SINGLE_FLIGHT_MAX_WAIT_MS = 20_000;

// Both guarded by the ownership token: an expired-and-retaken lock is neither renewed nor released
// by the caller that lost it.
const RENEW_OWN_LOCK =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) end";
const RELEASE_OWN_LOCK = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

type CacheRead<T> = { hit: true; value: T } | { hit: false };

const readCached = async <T>(redis: ReturnType<typeof getRedisClient>, key: string): Promise<CacheRead<T>> => {
  try {
    const cached = await redis.get(key);
    // superjson round-trips Date/BigInt/Map/Set; entries written before superjson (plain JSON)
    // deserialize to undefined and fall through to recompute.
    if (cached !== null) {
      const value = superjson.parse<T>(cached);
      if (value !== undefined) return { hit: true, value };
    }
  } catch (error) {
    log.error(`Cache read error for key ${key}:`, error);
    // Redis down - fall through to compute without cache
  }
  return { hit: false };
};

/**
 * Get-or-compute-and-set. On cache hit, returns the superjson-parsed value.
 * On miss, calls `fn`, caches the result, and returns it.
 * Null/undefined results get a short TTL so newly-created records are
 * discovered quickly.
 *
 * `ttl` may be a number (fixed seconds) or a function `(value) => seconds`
 * — useful when the TTL is derived from the value itself, e.g. a JWT's `exp`
 * claim. If the function returns ≤ 0, the value is returned but not cached.
 *
 * If `fn` throws, the error propagates and nothing is cached.
 *
 * Concurrent misses on the same key run `fn` once — see the single-flight constants above.
 */
export const cache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number) = DEFAULT_TTL,
): Promise<T> => {
  validateKey(key);

  const redis = getRedisClient();

  const cached = await readCached<T>(redis, key);
  if (cached.hit) return cached.value;

  const lockKey = `${key}:singleflight`;
  // Ownership token: a producer slower than the lock TTL must not delete the lock a LATER caller
  // now holds. Without it the release is unconditional and single-flight quietly stops working in
  // exactly the slow-producer case it exists for.
  const token = `${process.pid}:${randomUUID()}`;
  let holdsLock = false;
  let lockUnavailable = false;
  try {
    holdsLock = (await redis.set(lockKey, token, 'PX', SINGLE_FLIGHT_LOCK_TTL_MS, 'NX')) === 'OK';
  } catch (error) {
    // Redis is unreachable, so waiting on a key it cannot serve would burn the whole timeout on
    // failing reads. Compute instead — that is the documented fallback for every failure here.
    lockUnavailable = true;
    log.error(`Cache lock error for key ${key}:`, error);
  }

  if (!holdsLock && !lockUnavailable) {
    const deadline = Date.now() + SINGLE_FLIGHT_MAX_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(SINGLE_FLIGHT_POLL_MS);
      const polled = await readCached<T>(redis, key);
      if (polled.hit) return polled.value;
      // The holder let the lock go without a value appearing: it threw, or its ttl resolved to ≤ 0
      // so it never writes one. Either way no value is coming — stop waiting for it.
      const stillHeld = await redis.exists(lockKey).catch(() => 0);
      if (!stillHeld) break;
    }
  }

  const heartbeat = holdsLock
    ? setInterval(() => {
        redis.eval(RENEW_OWN_LOCK, 1, lockKey, token, SINGLE_FLIGHT_LOCK_TTL_MS).catch((error) => {
          log.error(`Cache lock renew error for key ${key}:`, error);
        });
      }, SINGLE_FLIGHT_HEARTBEAT_MS)
    : undefined;
  heartbeat?.unref();

  try {
    const value = await fn();
    const effectiveTtl = resolveTtl(value, ttl);

    if (effectiveTtl > 0) {
      const write = redis.setex(key, effectiveTtl, superjson.stringify(value)).catch((error) => {
        log.error(`Cache write error for key ${key}:`, error);
      });
      // Awaited only while holding the lock: waiters poll the value key, so releasing before
      // the write lands would send every one of them off to recompute.
      if (holdsLock) await write;
    }

    return value;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    if (holdsLock) {
      await redis.eval(RELEASE_OWN_LOCK, 1, lockKey, token).catch((error) => {
        log.error(`Cache lock release error for key ${key}:`, error);
      });
    }
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
    await redis.setex(key, ttl, superjson.stringify(value));
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

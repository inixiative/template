/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { db } from '@template/db/client';
import { cacheRead } from '@template/db/redis/cache/cacheRead';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { validateKey } from '@template/db/redis/cache/validateKey';

export type CacheOptions = {
  // Publish only if the key is still empty, so a computed value never overwrites a fresher value
  // another writer set while the producer read.
  shouldKeepExisting?: boolean;
  // Inside `db.txn()`, skip the cache and run the producer: a read of uncommitted rows must never be
  // published to other callers.
  shouldBypassInTxn?: boolean;
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
 * If `fn` throws, the error propagates and nothing is cached. Concurrent misses on the same key
 * run `fn` once (acquireSingleFlight), and a clear that runs while `fn` reads cancels its publish.
 */
export const cache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number) = DEFAULT_TTL,
  { shouldKeepExisting = false, shouldBypassInTxn = false }: CacheOptions = {},
): Promise<T> => {
  validateKey(key);
  if (shouldBypassInTxn && db.isInTxn()) return fn();
  return withCacheSpan(key, true, (setResult) =>
    cacheRead(key, fn, ttl, shouldKeepExisting, setResult),
  );
};

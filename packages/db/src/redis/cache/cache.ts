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
  shouldKeepExisting?: boolean;
  shouldBypassInTxn?: boolean;
};

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

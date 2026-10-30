/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { db } from '@template/db/client';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { readThrough } from '@template/db/redis/cache/readThrough';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { readInTransaction } from '@template/db/redis/cache/transactionOverlay/readInTransaction';
import { validateKey } from '@template/db/redis/cache/validateKey';

export const cache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number) = DEFAULT_TTL,
): Promise<T> => {
  validateKey(key);
  const overlay = db.cacheOverlay();
  return withCacheSpan(key, true, (setResult) =>
    overlay ? readInTransaction(overlay, key, fn, setResult) : readThrough(key, fn, ttl, setResult),
  );
};

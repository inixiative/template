/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { db } from '@template/db/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { readThrough } from '@template/db/redis/cache/readThrough';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { readInTransaction } from '@template/db/redis/cache/transactionOverlay/readInTransaction';
import { validateCacheKeyHasNoUndefined } from '@template/db/redis/cache/validateCacheKeyHasNoUndefined';

export const fetchThroughCache = async <T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number) = DEFAULT_TTL,
): Promise<T> => {
  validateCacheKeyHasNoUndefined(key);
  const live = (): Promise<T> => auditActorContext.withoutDeleted(fn) as Promise<T>;
  const overlay = db.cacheOverlay();
  return withCacheSpan(key, true, (setResult) =>
    overlay
      ? readInTransaction(overlay, key, live, ttl, setResult)
      : readThrough(key, live, ttl, setResult),
  );
};

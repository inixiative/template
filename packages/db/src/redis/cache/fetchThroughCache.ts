/**
 * @atlas
 * @partOf primitive:caching, infrastructure:redis, infrastructure:prisma
 * @uses infrastructure:observability
 */
import { db } from '@template/db/client';
import { auditActorContext } from '@template/db/lib/auditActorContext';
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { fetchThroughRedisWithSingleFlight } from '@template/db/redis/cache/fetchThroughRedisWithSingleFlight';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { fetchThroughTransactionCacheOverlay } from '@template/db/redis/cache/transactionOverlay/fetchThroughTransactionCacheOverlay';
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
      ? fetchThroughTransactionCacheOverlay(overlay, key, live, ttl, setResult)
      : fetchThroughRedisWithSingleFlight(key, live, ttl, setResult),
  );
};

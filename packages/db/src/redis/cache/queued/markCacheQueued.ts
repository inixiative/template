/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { cacheQueuedMarkerKeyFor } from '@template/db/redis/cache/queued/cacheQueuedMarkerKeyFor';
import { redisClient } from '@template/db/redis/client';

export const markCacheQueued = async (
  computedUnder: string,
  ttlSeconds: number,
): Promise<boolean> =>
  (await redisClient().set(
    cacheQueuedMarkerKeyFor(computedUnder),
    String(Date.now()),
    'EX',
    ttlSeconds,
    'NX',
  )) === 'OK';

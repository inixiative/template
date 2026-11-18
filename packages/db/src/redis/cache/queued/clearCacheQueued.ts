/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { cacheQueuedMarkerKeyFor } from '@template/db/redis/cache/queued/cacheQueuedMarkerKeyFor';
import { getRedisClient } from '@template/db/redis/client';

export const clearCacheQueued = async (computedUnder: string): Promise<void> => {
  await getRedisClient().del(cacheQueuedMarkerKeyFor(computedUnder));
};

/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { queuedKey } from '@template/db/redis/cache/queued/queuedKey';
import { getRedisClient } from '@template/db/redis/client';

export const clearCacheQueued = async (computedUnder: string): Promise<void> => {
  await getRedisClient().del(queuedKey(computedUnder));
};

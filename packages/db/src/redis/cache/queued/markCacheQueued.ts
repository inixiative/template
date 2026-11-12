/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { queuedKey } from '@template/db/redis/cache/queued/queuedKey';
import { getRedisClient } from '@template/db/redis/client';

export const markCacheQueued = async (
  computedUnder: string,
  ttlSeconds: number,
): Promise<boolean> =>
  (await getRedisClient().set(
    queuedKey(computedUnder),
    String(Date.now()),
    'EX',
    ttlSeconds,
    'NX',
  )) === 'OK';

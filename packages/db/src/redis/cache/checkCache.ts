/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { singleFlightLockKey } from '@template/db/lock/singleFlight/singleFlightLock';
import type { CacheCheck } from '@template/db/redis/cache/cacheStates';
import { cacheWrittenMarkerKeyFor } from '@template/db/redis/cache/cacheWrittenMarkerKeyFor';
import { cacheQueuedMarkerKeyFor } from '@template/db/redis/cache/queued/cacheQueuedMarkerKeyFor';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { validateCacheKeyHasNoUndefined } from '@template/db/redis/cache/validateCacheKeyHasNoUndefined';
import { redisClient } from '@template/db/redis/client';
import superjson from 'superjson';

export const checkCache = async <T>(
  key: string,
  {
    freshForSeconds,
    computedUnder = key,
  }: { freshForSeconds?: number; computedUnder?: string } = {},
): Promise<CacheCheck<T>> => {
  validateCacheKeyHasNoUndefined(key);
  return withCacheSpan(key, true, async (setResult) => {
    try {
      const [payload, written, lock, queued] = await redisClient().mget(
        key,
        cacheWrittenMarkerKeyFor(key),
        singleFlightLockKey(computedUnder),
        cacheQueuedMarkerKeyFor(computedUnder),
      );
      const isComputing = lock !== null;
      const isQueued = !isComputing && queued !== null;
      const value = payload == null ? undefined : superjson.parse<T>(payload);
      if (value === undefined) {
        return { state: isComputing ? 'computing' : isQueued ? 'queued' : 'empty' };
      }

      setResult('hit');
      const writtenAt = written ? new Date(Number(written)) : undefined;
      const isStale =
        freshForSeconds !== undefined &&
        (!writtenAt || Date.now() - writtenAt.getTime() > freshForSeconds * 1000);
      return { state: isStale ? 'stale' : 'fresh', value, writtenAt, isComputing, isQueued };
    } catch (error) {
      setResult('error');
      throw error;
    }
  });
};

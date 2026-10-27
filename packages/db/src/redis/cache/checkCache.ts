/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { singleFlightLockKey } from '@template/db/lock/singleFlight/singleFlightLock';
import type { CacheCheck } from '@template/db/redis/cache/cacheStates';
import { queuedKey } from '@template/db/redis/cache/queued/queuedKey';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { validateKey } from '@template/db/redis/cache/validateKey';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import superjson from 'superjson';

// Reads a key without computing it: the value, its write time, whether a compute holds the
// single-flight lock of `computedUnder` (default: the key itself) and whether a refresh of it is
// queued, in one MGET. With `freshForSeconds`, a value older than the window, or with no write time,
// is stale; without it any value is fresh. A Redis failure throws rather than reading as empty: a
// caller that queues work on a miss would otherwise pile work onto an outage.
export const checkCache = async <T>(
  key: string,
  {
    freshForSeconds,
    computedUnder = key,
  }: { freshForSeconds?: number; computedUnder?: string } = {},
): Promise<CacheCheck<T>> => {
  validateKey(key);
  return withCacheSpan(key, true, async (setResult) => {
    try {
      const [payload, written, lock, queued] = await getRedisClient().mget(
        key,
        writtenKey(key),
        singleFlightLockKey(computedUnder),
        queuedKey(computedUnder),
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

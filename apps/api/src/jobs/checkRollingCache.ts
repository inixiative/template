/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import type {
  CacheCheck,
  RollingCache,
  RollingCacheResultParams,
  RollingCacheResults,
  RollingCacheValue,
} from '@template/db';
import { enqueueJob } from '#/jobs/enqueue';

export type RollingCacheCheck<TValue> = CacheCheck<TValue> & { channel?: string };

// The api's read of a rolling cache: name the result and pass its params. It reads that entry
// (`rollingCache.read`); on `empty`, or `stale` with nothing computing, it queues the target's leaf
// (refreshRollingCacheTarget, keyed by `targetKey`) and reads again, so the answer reflects the queued
// work. It never computes and never waits. A miss on any result refreshes the whole target. The
// returned `channel` is where the refresh will be announced, so a route can tell its client where to
// wait without building the channel name itself.
export const checkRollingCache = async <
  TTarget,
  TResults extends RollingCacheResults<TTarget>,
  R extends keyof TResults & string,
>(
  rollingCache: RollingCache<TTarget, TResults>,
  result: R,
  params: RollingCacheResultParams<TResults, R>,
): Promise<RollingCacheCheck<RollingCacheValue>> => {
  const target = rollingCache.targetOf(params);
  const channel = rollingCache.channel?.(target);
  const check = await rollingCache.read(result, params);
  const needsRefresh =
    check.state === 'empty' || (check.state === 'stale' && !check.isComputing && !check.isQueued);
  if (!needsRefresh) return { ...check, channel };

  if (await rollingCache.markQueued(target)) {
    try {
      await enqueueJob('refreshRollingCacheTarget', {
        name: rollingCache.name,
        key: rollingCache.targetKey(target),
        target,
      });
    } catch (error) {
      await rollingCache.clearQueued(target);
      throw error;
    }
  }
  return { ...(await rollingCache.read(result, params)), channel };
};

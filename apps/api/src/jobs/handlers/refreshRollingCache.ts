/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import { getRedisClient, getRollingCache } from '@template/db';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { rollingCacheTimerKey } from '#/jobs/rollingCacheTimerKey';

export type RefreshRollingCachePayload = { name: string };

// The branch for one cache: a keyed staged singleton. Its one stage resolves the cache's targets and
// adds one refreshRollingCacheTarget per target as a child, keyed by `targetKey` and with their starts
// spread across the cache's `spreadSeconds`. The branch then waits in
// `waiting-children`, holding no worker slot, until every leaf has reported, and `finish` starts the
// cache's timer, so the next refresh is one interval after the data was fresh, not after it was
// requested.
//
// Another branch for the same cache cannot start while this one is open: it is added with the
// singleton's deduplication id, which holds while the branch is parked, and the lock guards each step
// it runs. A leaf that fails all its retries keeps its last good value and still lets the branch close
// (enqueueChildJob sets `ignoreDependencyOnFailure`); the next interval tries it again. An unregistered
// name throws (getRollingCache).
export const refreshRollingCache = makeSingletonJob<RefreshRollingCachePayload>(
  {
    stages: [
      async (ctx, { name }) => {
        const rollingCache = getRollingCache(name);
        const targets = await rollingCache.targets();
        await ctx.enqueueChildJobs(
          'refreshRollingCacheTarget',
          targets.map((target) => ({ name, key: rollingCache.targetKey(target), target })),
          { spreadSeconds: rollingCache.spreadSeconds },
        );
      },
    ],
    finish: async (_ctx, { name }) => {
      const { intervalSeconds } = getRollingCache(name);
      await getRedisClient().set(
        rollingCacheTimerKey(name),
        new Date().toISOString(),
        'EX',
        intervalSeconds,
      );
    },
  },
  { lockKey: ({ name }) => name },
);

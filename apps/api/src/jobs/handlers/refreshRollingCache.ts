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

// The branch for one cache: one pass. A keyed staged singleton. Its one stage resolves the cache's
// targets, adds one refreshRollingCacheTarget per target as a child, keyed by `targetKey` and with
// their starts spread across the cache's `spreadSeconds`, and then starts the cache's timer. The next
// pass is due one interval after this one started, however long its leaves take. The branch then waits
// in `waiting-children`, holding no worker slot, until every leaf has reported.
//
// The timer is set in the stage, after the leaves are added: the stage runs once per pass (its index
// lives on the job; only a worker that dies mid-stage runs it again, which re-adds the superseding
// leaves and restarts the timer a moment later). A stage that throws sets no timer, so the cache stays
// due and the first tick after this branch fails starts another.
//
// Another branch for the same cache cannot start while this one is open: it is added with the
// singleton's deduplication id, which holds while the branch is parked, and the lock guards each step
// it runs. A pass that outlasts its interval is never overlapped: its timer runs out while it is open,
// each tick's enqueue is a no-op, and the next pass starts on the first tick after it closes. A leaf
// that fails all its retries keeps its last good value and still lets the branch close
// (enqueueChildJob sets `ignoreDependencyOnFailure`); the next pass tries it again. An unregistered
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
        await getRedisClient().set(
          rollingCacheTimerKey(name),
          new Date().toISOString(),
          'EX',
          rollingCache.intervalSeconds,
        );
      },
    ],
    finish: async () => {},
  },
  { lockKey: ({ name }) => name },
);

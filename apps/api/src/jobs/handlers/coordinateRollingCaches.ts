/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis
 */
import { getRedisClient, listRollingCaches, ROLLING_CACHE_TICK_SECONDS } from '@template/db';
import { enqueueJob } from '#/jobs/enqueue';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { rollingCacheTimerKey } from '#/jobs/rollingCacheTimerKey';

// The root: one cron job behind every rolling cache (seeded `coordinateRollingCaches`, every minute).
// Each cache keeps its own timer, so caches with different intervals share it. On a tick, every cache
// whose timer has a tick or less left gets its branch enqueued. That is all: the branch is a keyed
// singleton deduplicated on the cache name, so enqueueing it while one is still open is a no-op, and
// BullMQ itself holds the branch open until its leaves report. The timer is set by the branch when it
// closes, so a failed enqueue leaves the cache due and the next tick tries again. Singleton, so
// overlapping ticks never coordinate twice. A failure throws and fails the tick; the next tick runs
// every cache again.
export const coordinateRollingCaches = makeSingletonJob(async () => {
  for (const { name } of listRollingCaches()) {
    const msLeft = await getRedisClient().pttl(rollingCacheTimerKey(name));
    if (msLeft > ROLLING_CACHE_TICK_SECONDS * 1000) continue;
    await enqueueJob('refreshRollingCache', { name });
  }
});

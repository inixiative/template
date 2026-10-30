/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs, primitive:caching
 * @uses infrastructure:redis, primitive:appEvents
 */
import { getRollingCache } from '@template/db';
import { settleWithin } from '@template/shared/utils';
import { emitAppEvent } from '#/appEvents/emit';
import { isFinalAttempt } from '#/jobs/isFinalAttempt';
import { makeJob } from '#/jobs/makeJob';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import { JobLane } from '#/jobs/types';

export type RefreshRollingCacheTargetPayload = { name: string; key: string; target: unknown };

// The leaf: refreshes one target of one rolling cache. It runs as a child of its branch, which BullMQ
// keeps open until it reports. Slow lane: background recomputes fanned out in bulk.
//
// Each attempt has `timeoutSeconds`. Past it the leaf emits `rollingCache.leafStuck` with its
// provenance (cache, key, target row, timeout, attempt) and throws, so BullMQ retries it; after the
// last attempt it counts as done and the branch closes. The compute that hung cannot be stopped
// (handlers run in-process), so the deadline also aborts the signal `refresh` checks before it writes:
// a late result never overwrites a newer one.
//
// A refresh that lands emits `rollingCache.refreshed`, carrying the cache's channel for this target
// when it declares one, so subscribers get a refetch hint.
//
// Superseding, keyed by the target's `targetKey` (cache name plus target fields): a forced refresh (enqueueing this leaf directly)
// replaces a running copy instead of racing it. An unregistered cache name throws (getRollingCache),
// and so does a failed write.
export const refreshRollingCacheTarget = makeSupersedingJob<RefreshRollingCacheTargetPayload>(
  makeJob<RefreshRollingCacheTargetPayload>(
    async ({ job, signal }, { name, key, target }) => {
      const { refresh, timeoutSeconds, channel, clearQueued } = getRollingCache(name);
      const deadline = AbortSignal.timeout(timeoutSeconds * 1000);
      const refreshSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
      const reportStuck = async (): Promise<never> => {
        await emitAppEvent('rollingCache.leafStuck', {
          rollingCache: name,
          key,
          target,
          timeoutSeconds,
          attempt: job.attemptsMade + 1,
        });
        throw new Error(`Rolling cache "${name}" did not refresh ${key} within ${timeoutSeconds}s`);
      };
      const isRefreshed = await settleWithin(
        refresh(target, { signal: refreshSignal }),
        timeoutSeconds * 1000,
        reportStuck,
      )
        .then((refreshed) => (refreshed || !deadline.aborted ? refreshed : reportStuck()))
        .catch(async (error: unknown) => {
          if (!signal?.aborted && isFinalAttempt(job)) await clearQueued(target);
          throw error;
        });
      if (isRefreshed) {
        await emitAppEvent('rollingCache.refreshed', {
          rollingCache: name,
          key,
          channel: channel?.(target),
        });
      }
    },
    { lane: JobLane.slow },
  ),
  ({ key }) => key,
);

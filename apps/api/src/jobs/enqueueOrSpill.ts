/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { claimLane, laneKey, releaseLane } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { isSlowJobData } from '#/jobs/buildJobData';
import { evictSupersededFlow } from '#/jobs/evictSupersededFlow';
import { withLanePriority } from '#/jobs/lanePriority';
import {
  isLaneOverflowing,
  outboxLaneOf,
  shouldSpill,
  spillToOutbox,
  tripIfFull,
} from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import { singletonDeduplicationId } from '#/jobs/singletonDeduplicationId';
import { recordDelayedSlowAdd } from '#/jobs/slowLaneSignals';
import { type JobData, type JobOptions, JobType } from '#/jobs/types';

export type EnqueueOrSpillArgs = {
  handlerName: string;
  jobId: string;
  data: JobData;
  options: JobOptions;
  bypass: boolean;
  // The handler's singleton key for this payload (SingletonJobHandler.singletonKey): the job is added
  // with its deduplication id, so a second add while one exists is a no-op.
  singletonKey?: string;
  // The handler is staged (runJobStages): a superseded copy may be parked with children to evict.
  isStaged?: boolean;
};

export type EnqueueOrSpillResult = { jobId: string; outboxed?: true };

export const enqueueOrSpill = async ({
  handlerName,
  jobId,
  data,
  options,
  bypass,
  singletonKey,
  isStaged = false,
}: EnqueueOrSpillArgs): Promise<EnqueueOrSpillResult> => {
  const baton = data.dedupeKey ? laneKey(handlerName, data.dedupeKey) : undefined;
  const lane = outboxLaneOf({ data });
  const jobOptions = withLanePriority(
    data,
    singletonKey
      ? { ...options, deduplication: { id: singletonDeduplicationId(handlerName, singletonKey) } }
      : options,
  );
  // A staged superseding job that took its lane from a copy parked in `waiting-children` evicts that
  // copy's unfinished children, once this job is safely placed. Like the depth probe, a failure is
  // logged and never rejects: the new job is already queued.
  const evictReplacedFlow = async (previousHolder: string | null): Promise<void> => {
    if (!isStaged || !previousHolder || previousHolder === jobId) return;
    try {
      const evicted = await evictSupersededFlow(previousHolder);
      if (evicted > 0)
        log.info(
          `Evicted ${evicted} children of superseded flow ${previousHolder} (${handlerName})`,
          LogScope.job,
        );
    } catch (err) {
      log.error(
        `Failed to evict the children of superseded flow ${previousHolder} (${handlerName})`,
        err,
        LogScope.job,
      );
    }
  };
  // A flow child (`parent` set by a stage's enqueueChildJob) never spills: the drain's re-add would
  // lose its parent link, and the parent would wait on a child BullMQ never heard of.
  const isFlowChild = options.parent !== undefined;
  const overflowing =
    data.type === JobType.adhoc && !bypass && !isFlowChild && (await isLaneOverflowing(lane));

  if (shouldSpill(data.type, bypass, overflowing)) {
    // Claim at SPILL time too, not just at drain: the newest enqueue must hold the baton even while
    // buffered, so an older in-flight run aborts now instead of finishing with stale data during the
    // outbox dwell. The drain re-claims under the same jobId when it re-adds (self-claim, no-op).
    const previousHolder = baton ? await claimLane(baton, jobId, jobOptions.delay) : null;
    try {
      await spillToOutbox({
        handlerName,
        jobId,
        dedupeKey: data.dedupeKey ?? null,
        data,
        options: jobOptions,
      });
    } catch (err) {
      if (baton) await releaseLane(baton, jobId, previousHolder).catch(() => {});
      throw err;
    }
    log.info(`Spilled job ${handlerName} to outbox (${jobId}, ${lane} lane over pressure)`);
    await evictReplacedFlow(previousHolder);
    return { jobId, outboxed: true };
  }

  // Claim the lane BEFORE adding so the job holds the baton the instant it starts. If the add then
  // fails, no job exists to hold the baton — roll the claim back (fenced, so a concurrent claim isn't
  // clobbered) rather than leaving the prior job superseded by a phantom that never ran. The claim's
  // TTL stretches by the job's `delay` — the baton must survive until the job actually runs.
  let previousHolder: string | null = null;
  let placedId = jobId;
  try {
    if (baton) previousHolder = await claimLane(baton, jobId, jobOptions.delay);
    const added = await queue.add(handlerName, data, { ...jobOptions, jobId });
    placedId = added?.id ?? jobId;
  } catch (err) {
    if (baton) await releaseLane(baton, jobId, previousHolder).catch(() => {});
    throw err;
  }
  if (placedId !== jobId) {
    log.info(`Deduplicated job ${handlerName}: ${placedId} already holds its singleton key`);
    return { jobId: placedId };
  }
  await evictReplacedFlow(previousHolder);
  if (jobOptions.delay && isSlowJobData(data))
    await recordDelayedSlowAdd(queue, jobId, jobOptions.delay);
  if (data.type === JobType.adhoc) await tripIfFull();

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId };
};

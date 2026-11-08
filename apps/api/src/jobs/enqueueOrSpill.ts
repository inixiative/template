/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { claimLane, laneKey, releaseLane } from '@template/db';
import { log } from '@template/shared/logger';
import { isSlowJobData } from '#/jobs/buildJobData';
import { withLanePriority } from '#/jobs/lanePriority';
import {
  isLaneOverflowing,
  outboxLaneOf,
  recordAddAndTripIfFull,
  shouldSpill,
  spillToOutbox,
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
  // with its deduplication id, so while a job with that key exists — queued, running, retrying, or
  // parked waiting on its children — another add is a no-op (BullMQ answers with the holder's id).
  singletonKey?: string;
};

export type EnqueueOrSpillResult = { jobId: string; outboxed?: true };

// Redis's refusal under maxmemory with noeviction; BullMQ's add script surfaces the ReplyError unchanged.
const isRedisOutOfMemory = (err: unknown): boolean =>
  err instanceof Error && err.message.includes('OOM command not allowed');

export const enqueueOrSpill = async ({
  handlerName,
  jobId,
  data,
  options,
  bypass,
  singletonKey,
}: EnqueueOrSpillArgs): Promise<EnqueueOrSpillResult> => {
  const baton = data.dedupeKey ? laneKey(handlerName, data.dedupeKey) : undefined;
  const lane = outboxLaneOf({ data });
  const jobOptions = withLanePriority(
    data,
    singletonKey
      ? { ...options, deduplication: { id: singletonDeduplicationId(handlerName, singletonKey) } }
      : options,
  );
  // A flow child (`parent` set by a stage's enqueueChildJob) never spills: the drain's re-add would
  // lose its parent link, and the parent would wait on a child BullMQ never heard of.
  const isFlowChild = options.parent !== undefined;
  const canSpill = data.type === JobType.adhoc && !bypass && !isFlowChild;

  const spill = async (): Promise<EnqueueOrSpillResult> => {
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
      if (baton) await releaseLane(baton, jobId, previousHolder);
      throw err;
    }
    log.info(`Spilled job ${handlerName} to outbox (${jobId}, ${lane} lane over pressure)`);
    return { jobId, outboxed: true };
  };

  const overflowing = canSpill && (await isLaneOverflowing(lane));
  if (shouldSpill(data.type, bypass, overflowing)) return spill();

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
    if (baton) await releaseLane(baton, jobId, previousHolder);
    // A full Redis (noeviction) refuses the add: spill instead of failing the caller. A superseding
    // job's lane release or claim can itself be refused under a full Redis; that error surfaces.
    if (!canSpill || !isRedisOutOfMemory(err)) throw err;
    log.warn(`Redis refused ${handlerName} (out of memory); spilling to the outbox (${jobId})`);
    return spill();
  }
  if (placedId !== jobId) {
    log.info(`Deduplicated job ${handlerName}: ${placedId} already holds its singleton key`);
    return { jobId: placedId };
  }
  if (jobOptions.delay && isSlowJobData(data))
    await recordDelayedSlowAdd(queue, jobId, jobOptions.delay);
  if (data.type === JobType.adhoc) await recordAddAndTripIfFull(isSlowJobData(data));

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId };
};

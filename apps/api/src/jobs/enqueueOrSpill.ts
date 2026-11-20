/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import { claimLane, laneKey, markDisplacedHolder } from '@template/db';
import { log } from '@template/shared/logger';
import { isSlowJobData } from '#/jobs/buildJobData';
import { jobLaneStore } from '#/jobs/jobLaneStore';
import { withLanePriority } from '#/jobs/lanePriority';
import {
  isLaneOverflowing,
  outboxLaneOf,
  recordEnqueueAndSetOverflowFlagForLanesAtCap,
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

  // A spill does not take the lane: the drain takes it when it re-adds the row (claimLaneUnlessNewerHolder),
  // so a lane only ever names a job BullMQ holds.
  const spill = async (): Promise<EnqueueOrSpillResult> => {
    await spillToOutbox({
      handlerName,
      jobId,
      dedupeKey: data.dedupeKey ?? null,
      data,
      options: jobOptions,
    });
    log.info(`Spilled job ${handlerName} to outbox (${jobId}, ${lane} lane over pressure)`);
    return { jobId, outboxed: true };
  };

  const overflowing = canSpill && (await isLaneOverflowing(lane));
  if (shouldSpill(data.type, bypass, overflowing)) return spill();

  // The claim comes before the add so the job holds its lane the moment it starts; the job it displaced
  // is marked only once this one exists. A failed add throws and leaves nothing to undo: no mark was
  // written, and a lane naming a job that never existed counts as no holder.
  let previousHolder: string | null = null;
  let placedId = jobId;
  try {
    if (baton) previousHolder = await claimLane(jobLaneStore, baton, jobId, jobOptions.delay);
    const added = await queue.add(handlerName, data, { ...jobOptions, jobId });
    placedId = added?.id ?? jobId;
  } catch (err) {
    if (!canSpill || !isRedisOutOfMemory(err)) throw err;
    log.warn(`Redis refused ${handlerName} (out of memory); spilling to the outbox (${jobId})`);
    return spill();
  }
  if (baton) await markDisplacedHolder(jobLaneStore, baton, jobId, previousHolder);
  if (placedId !== jobId) {
    log.info(`Deduplicated job ${handlerName}: ${placedId} already holds its singleton key`);
    return { jobId: placedId };
  }
  if (jobOptions.delay && isSlowJobData(data))
    await recordDelayedSlowAdd(queue, jobId, jobOptions.delay);
  if (data.type === JobType.adhoc)
    await recordEnqueueAndSetOverflowFlagForLanesAtCap(isSlowJobData(data));

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId };
};

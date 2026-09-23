/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { laneKey, releaseLane, transferLane } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { spillToOutbox } from '#/jobs/outbox/accumulator';
import type { JobData, JobOptions, WorkerContext } from '#/jobs/types';

type ReplayableJobOptions = Omit<JobOptions, 'jobId' | 'delay'>;

// Only our own producer options survive a refusal. The refused instance's delay was already served,
// and its BullMQ scheduling state (repeat, timestamps, id) belongs to that completed instance.
const REPLAYABLE_JOB_OPTION_KEYS = {
  attempts: true,
  backoff: true,
  priority: true,
  removeOnComplete: true,
  removeOnFail: true,
} satisfies Record<keyof ReplayableJobOptions, true>;

// The replacement keeps only the retries the refused job had left, so a failing job that keeps
// meeting a full fleet still runs out of attempts instead of restarting its budget on every refusal.
const replayableOptions = (job: WorkerContext['job']): ReplayableJobOptions => {
  const options = Object.fromEntries(
    (Object.keys(REPLAYABLE_JOB_OPTION_KEYS) as Array<keyof ReplayableJobOptions>)
      .filter((key) => job.opts[key] !== undefined)
      .map((key) => [key, job.opts[key]]),
  ) as ReplayableJobOptions;
  if (options.attempts !== undefined) options.attempts = Math.max(1, options.attempts - (job.attemptsMade ?? 0));
  return options;
};

export const spillRefusedSlowJob = async (ctx: WorkerContext, spill = spillToOutbox): Promise<string | null> => {
  const data = ctx.job.data as JobData;
  // A refused job completes and stays in BullMQ's completed set; re-adding under its id would be
  // silently deduplicated, so the replacement always gets a fresh one.
  const jobId = Bun.randomUUIDv7();
  const lane = data.dedupeKey ? laneKey(ctx.job.name, data.dedupeKey) : undefined;
  // A superseding job that a newer claim already displaced is dropped, never revived: re-buffering it
  // would take the baton back and its stale row would overwrite the newer one in the outbox.
  if (lane && !(await transferLane(lane, ctx.job.id ?? '', jobId))) {
    log.info(`Slow-lane job ${ctx.job.name} (${ctx.job.id}) refused a slot and was superseded; dropped`, LogScope.job);
    return null;
  }

  try {
    await spill(
      {
        handlerName: ctx.job.name,
        jobId,
        dedupeKey: data.dedupeKey ?? null,
        data,
        options: replayableOptions(ctx.job),
      },
      { flushImmediately: true },
    );
  } catch (err) {
    if (lane) await releaseLane(lane, jobId, ctx.job.id ?? null).catch(() => {});
    throw err;
  }

  log.info(`Slow-lane job ${ctx.job.name} (${ctx.job.id}) refused a slot; buffered as ${jobId}`, LogScope.job);
  return jobId;
};

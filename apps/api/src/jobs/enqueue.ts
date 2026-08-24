/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { claimLane, db, laneKey, releaseLane } from '@template/db';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import type { Job } from 'bullmq';
import type { JobPayloads } from '#/jobs/handlers';
import type { SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import { isOverflowing, shouldSpill, spillToOutbox, tripIfFull } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import { type JobOptions, JobType, type WorkerContext } from '#/jobs/types';

type EnqueueOptions = JobOptions & {
  type?: (typeof JobType)[keyof typeof JobType];
  id?: string;
  bypass?: boolean; // skip the overflow buffer — latency-critical jobs go straight to BullMQ
};

export const enqueueJob = async <K extends keyof JobPayloads>(
  handlerName: K,
  payload: JobPayloads[K],
  options?: EnqueueOptions,
) => {
  // Lazy-load the handler registry to break the eval-time import cycle: handlers import enqueueJob
  // (jobs re-enqueue jobs), and the registry imports every handler — a static import here closes the
  // loop and TDZ-throws whenever a single handler module is loaded before `handlers/index.ts`. The
  // registry is only needed at call time, so importing it here (module-cached) is the single-site fix.
  const { isValidHandlerName, jobHandlers } = await import('#/jobs/handlers');

  if (!isValidHandlerName(handlerName)) {
    throw new Error(`Unknown job handler: ${handlerName}`);
  }

  const { type = JobType.adhoc, id, bypass = false, ...jobOptions } = options || {};

  const handler = jobHandlers[handlerName] as SupersedingJobHandler<JobPayloads[K]>;

  // In test, skip BullMQ entirely — just run the handler. Cascading effects
  // happen for real, errors propagate, no queue infrastructure involved.
  // Delayed jobs are the exception: they're scheduled for a future moment, so
  // running them at enqueue time would execute wrong-time semantics — they
  // return unrun, like the queue still holding them. To test one, call the
  // handler directly.
  if (isTest) {
    const jobId = id ?? Bun.randomUUIDv7();
    if (jobOptions.delay !== undefined) {
      log.info(`Test enqueue: ${handlerName} (${jobId}) carries delay=${jobOptions.delay}ms — returned unrun`);
      return { jobId, name: handlerName };
    }
    const ctx: WorkerContext = {
      db,
      queue,
      job: { id: jobId, name: handlerName, data: { type, id, payload } } as Job,
    };
    await (handler as (workerCtx: WorkerContext, p?: unknown) => Promise<void>)(ctx, payload);
    return { jobId, name: handlerName };
  }

  const dedupeKey = handler.dedupeKeyFn ? handler.dedupeKeyFn(payload) : undefined;
  const jobId = jobOptions.jobId ?? Bun.randomUUIDv7();

  const lane = dedupeKey ? laneKey(handlerName, dedupeKey) : undefined;

  const overflowing = type === JobType.adhoc && !bypass && (await isOverflowing());
  if (shouldSpill(type, bypass, overflowing)) {
    // Claim at SPILL time too, not just at drain: the newest enqueue must hold the baton even while
    // buffered, so an older in-flight run aborts now instead of finishing with stale data during the
    // outbox dwell. The drain re-claims under the same jobId when it re-adds (self-claim, no-op).
    const previousHolder = lane ? await claimLane(lane, jobId, jobOptions.delay) : null;
    try {
      await spillToOutbox({
        handlerName,
        jobId,
        dedupeKey: dedupeKey ?? null,
        data: { type, id, payload, dedupeKey },
        options: jobOptions,
      });
    } catch (err) {
      if (lane) await releaseLane(lane, jobId, previousHolder).catch(() => {});
      throw err;
    }
    log.info(`Spilled job ${handlerName} to outbox (${jobId})`);
    return { jobId, name: handlerName, outboxed: true as const };
  }

  // Claim the lane BEFORE adding so the job holds the baton the instant it starts. If the add then
  // fails, no job exists to hold the baton — roll the claim back (fenced, so a concurrent claim isn't
  // clobbered) rather than leaving the prior job superseded by a phantom that never ran. The claim's
  // TTL stretches by the job's `delay` — the baton must survive until the job actually runs.
  const previousHolder = lane ? await claimLane(lane, jobId, jobOptions.delay) : null;
  try {
    await queue.add(handlerName, { type, id, payload, dedupeKey }, { ...jobOptions, jobId });
  } catch (err) {
    if (lane) await releaseLane(lane, jobId, previousHolder).catch(() => {});
    throw err;
  }
  if (type === JobType.adhoc) await tripIfFull();

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId, name: handlerName };
};

/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import type { Job } from 'bullmq';
import { uuidv7 } from 'uuidv7';
import { isValidHandlerName, type JobPayloads, jobHandlers } from '#/jobs/handlers';
import type { SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import { isOverflowing, shouldSpill, signalSupersededJobs, spillToOutbox, tripIfFull } from '#/jobs/outbox';
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
  if (!isValidHandlerName(handlerName)) {
    throw new Error(`Unknown job handler: ${handlerName}`);
  }

  const { type = JobType.adhoc, id, bypass = false, ...jobOptions } = options || {};

  const handler = jobHandlers[handlerName] as SupersedingJobHandler<JobPayloads[K]>;

  // In test, skip BullMQ entirely — just run the handler. Cascading effects
  // happen for real, errors propagate, no queue infrastructure involved.
  if (isTest) {
    const jobId = id ?? uuidv7();
    const ctx: WorkerContext = {
      db,
      queue,
      job: { id: jobId, name: handlerName, data: { type, id, payload } } as Job,
    };
    await (handler as (workerCtx: WorkerContext, p?: unknown) => Promise<void>)(ctx, payload);
    return { jobId, name: handlerName };
  }

  const dedupeKey = handler.dedupeKeyFn ? handler.dedupeKeyFn(payload) : undefined;

  // Overflow buffer — adhoc only; cron/cronTrigger and `bypass` go straight to BullMQ (outbox.ts).
  // isOverflowing() is only probed for spill-eligible jobs (no Redis GET on cron/bypass).
  const overflowing = type === JobType.adhoc && !bypass && (await isOverflowing());
  if (shouldSpill(type, bypass, overflowing)) {
    // Supersession for spilled jobs is handled at drain admission — signalling here would cancel the
    // prior job ~a tick before its replacement is admitted (a window with no job in flight).
    const jobId = jobOptions.jobId ?? id ?? uuidv7();
    await spillToOutbox({
      handlerName,
      jobId,
      dedupeKey: dedupeKey ?? null,
      data: { type, id, payload, dedupeKey },
      options: jobOptions,
    });
    log.info(`Spilled job ${handlerName} to outbox (${jobId})`);
    return { jobId, name: handlerName, outboxed: true as const };
  }

  // Direct path only: abort the prior in-flight copy now (spilled jobs supersede at drain admission).
  if (dedupeKey) await signalSupersededJobs(handlerName, dedupeKey);
  // No jobId from dedupeKey — BullMQ would dedupe and drop the new payload; abort flag handles the prior job.
  const job = await queue.add(handlerName, { type, id, payload, dedupeKey }, jobOptions);
  if (type === JobType.adhoc) await tripIfFull(); // set the flag if this add crossed the cap

  log.info(`Enqueued job ${handlerName} (${job.id})`);

  return { jobId: job.id, name: job.name };
};

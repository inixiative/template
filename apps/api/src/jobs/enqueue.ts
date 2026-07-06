/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { claimLane, db, laneKey } from '@template/db';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import type { Job } from 'bullmq';
import { uuidv7 } from 'uuidv7';
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
  const jobId = jobOptions.jobId ?? uuidv7();

  const overflowing = type === JobType.adhoc && !bypass && (await isOverflowing());
  if (shouldSpill(type, bypass, overflowing)) {
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

  if (dedupeKey) await claimLane(laneKey(handlerName, dedupeKey), jobId);
  await queue.add(handlerName, { type, id, payload, dedupeKey }, { ...jobOptions, jobId });
  if (type === JobType.adhoc) await tripIfFull();

  log.info(`Enqueued job ${handlerName} (${jobId})`);
  return { jobId, name: handlerName };
};

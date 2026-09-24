/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { db } from '@template/db';
import { log } from '@template/shared/logger';
import { captureTraceContext } from '@template/shared/telemetry';
import { isTest } from '@template/shared/utils';
import type { Job } from 'bullmq';
import { admitEnvelope } from '#/jobs/admitEnvelope';
import { buildJobData } from '#/jobs/buildJobData';
import type { JobPayloads } from '#/jobs/handlers';
import type { SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import { queue } from '#/jobs/queue';
import { type JobLane, type JobOptions, JobType, type WorkerContext } from '#/jobs/types';
import { validateJobId } from '#/jobs/validateJobId';

export type EnqueueOptions = JobOptions & {
  type?: (typeof JobType)[keyof typeof JobType];
  id?: string;
  lane?: JobLane;
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

  const { type = JobType.adhoc, id, lane, bypass = false, ...jobOptions } = options || {};
  validateJobId(jobOptions.jobId);

  const handler = jobHandlers[handlerName] as SupersedingJobHandler<JobPayloads[K]>;
  const dedupeKey = handler.dedupeKeyFn ? handler.dedupeKeyFn(payload) : undefined;

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
    const data = buildJobData(handler, { type, id, payload, dedupeKey }, lane);
    const ctx: WorkerContext = {
      db,
      queue,
      job: { id: jobId, name: handlerName, data } as Job,
    };
    await (handler as (workerCtx: WorkerContext, p?: unknown) => Promise<void>)(ctx, payload);
    return { jobId, name: handlerName };
  }

  const data = buildJobData(handler, { type, id, payload, dedupeKey, traceContext: captureTraceContext() }, lane);
  const admission = await admitEnvelope({
    handlerName,
    jobId: jobOptions.jobId ?? Bun.randomUUIDv7(),
    data,
    options: jobOptions,
    bypass,
  });
  return { ...admission, name: handlerName };
};

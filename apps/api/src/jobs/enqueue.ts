import { db, redisNamespace } from '@template/db';
import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import type { Job } from 'bullmq';
import { uuidv7 } from 'uuidv7';
import { isValidHandlerName, type JobPayloads, jobHandlers } from '#/jobs/handlers';
import type { SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import { queue } from '#/jobs/queue';
import { type JobData, type JobOptions, JobType, type WorkerContext } from '#/jobs/types';

type EnqueueOptions = JobOptions & {
  type?: (typeof JobType)[keyof typeof JobType];
  id?: string;
};

const signalSupersededJobs = async (dedupeKey: string): Promise<void> => {
  const redis = queue.redis;
  const jobs = await queue.getJobs(['active', 'waiting', 'delayed', 'paused']);

  for (const job of jobs) {
    if (!job.id) continue;
    const jobData = job.data as JobData;
    if (jobData.dedupeKey === dedupeKey) {
      await redis.set(`${redisNamespace.job}:superseded:${job.id}`, '1', 'EX', 300);
      log.info(`Signaled job ${job.id} to abort (superseded)`);
    }
  }
};

export const enqueueJob = async <K extends keyof JobPayloads>(
  handlerName: K,
  payload: JobPayloads[K],
  options?: EnqueueOptions,
) => {
  if (!isValidHandlerName(handlerName)) {
    throw new Error(`Unknown job handler: ${handlerName}`);
  }

  const { type = JobType.adhoc, id, ...jobOptions } = options || {};

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

  if (dedupeKey) await signalSupersededJobs(dedupeKey);

  const job = await queue.add(
    handlerName,
    { type, id, payload, dedupeKey },
    { ...jobOptions, jobId: dedupeKey || undefined },
  );

  log.info(`Enqueued job ${handlerName} (${job.id})`);

  return { jobId: job.id, name: job.name };
};

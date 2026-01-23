import { queue } from './queue';
import { JobHandlerName, type JobHandlerNameType } from './types';
import type { JobsOptions } from 'bullmq';

type EnqueueOptions = JobsOptions & {
  deduplicationKey?: string;
};

export const enqueueJob = async (
  handlerName: JobHandlerNameType,
  payload: Record<string, unknown>,
  options?: EnqueueOptions,
) => {
  // Validate handler exists
  if (!Object.values(JobHandlerName).includes(handlerName)) {
    throw new Error(`Unknown job handler: ${handlerName}`);
  }

  const { deduplicationKey, ...jobOptions } = options || {};

  // Use deduplication key as job ID if provided
  const jobId = deduplicationKey || undefined;

  const job = await queue.add(
    handlerName,
    { payload },
    {
      ...jobOptions,
      jobId,
    },
  );

  console.log(`Enqueued job ${handlerName} (${job.id})`);

  return {
    jobId: job.id,
    name: job.name,
  };
};

import type { CronJob } from '@template/db/generated/client/client';
import { queue } from '#/jobs/queue';
import { JobType } from '#/jobs/types';

export const triggerCronJob = async (cronJob: CronJob) => {
  const job = await queue.add(cronJob.handler, {
    id: cronJob.id,
    type: JobType.cronTrigger,
    payload: cronJob.payload,
  });

  return { jobId: job.id, handler: cronJob.handler };
};

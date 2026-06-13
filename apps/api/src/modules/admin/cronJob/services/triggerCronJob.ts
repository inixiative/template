/**
 * @atlas
 * @kind service
 * @partOf feature:cronJob, superadmin
 * @uses primitive:jobs
 */
import type { CronJob } from '@template/db/generated/client/client';
import { enqueueJob } from '#/jobs/enqueue';
import type { JobPayloads } from '#/jobs/handlers';
import { JobType } from '#/jobs/types';

export const triggerCronJob = async (cronJob: CronJob) => {
  // Route through enqueueJob so production code goes through one queue seam,
  // and so the in-test no-op + jobId synthesis applies here too.
  const handler = cronJob.handler as keyof JobPayloads;
  const result = await enqueueJob(handler, cronJob.payload as JobPayloads[typeof handler], {
    id: cronJob.id,
    type: JobType.cronTrigger,
  });

  return { jobId: result.jobId, handler: cronJob.handler };
};

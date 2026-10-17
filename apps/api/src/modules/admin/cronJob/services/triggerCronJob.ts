/**
 * @atlas
 * @kind service
 * @partOf feature:cronJob, superadmin
 * @uses primitive:jobs
 */
import type { CronJob } from '@template/db/generated/client/client';
import { enqueueCronRun } from '#/jobs/enqueueCronRun';
import type { JobLane } from '#/jobs/types';

export const triggerCronJob = async (cronJob: CronJob, lane?: JobLane) => {
  // The same path a scheduled tick takes, so a manual trigger collides with a scheduled run of the row
  // like any two enqueues (a singleton is deduplicated on the row id).
  const result = await enqueueCronRun({
    handlerName: cronJob.handler,
    cronJobId: cronJob.id,
    payload: cronJob.payload,
    lane,
    attempts: cronJob.maxAttempts,
    backoff: { type: 'exponential', delay: cronJob.backoffMs },
  });

  return { jobId: result.jobId, handler: cronJob.handler };
};

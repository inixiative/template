/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:redis
 */
import type { CronJob } from '@template/db/generated/client/client';
import { buildJobData } from '#/jobs/buildJobData';
import { isValidHandlerName, jobHandlers } from '#/jobs/handlers';
import { withLanePriority } from '#/jobs/lanePriority';
import { queue } from '#/jobs/queue';
import { JobType } from '#/jobs/types';

export const upsertCronJobScheduler = async (cronJob: CronJob): Promise<void> => {
  if (!isValidHandlerName(cronJob.handler))
    throw new Error(`Unknown job handler: "${cronJob.handler}"`);
  const data = buildJobData(jobHandlers[cronJob.handler], {
    id: cronJob.id,
    type: JobType.cron,
    payload: cronJob.payload,
  });
  await queue.upsertJobScheduler(
    cronJob.jobId,
    { pattern: cronJob.pattern },
    {
      name: cronJob.handler,
      data,
      opts: withLanePriority(data, {
        attempts: cronJob.maxAttempts,
        backoff: { type: 'exponential', delay: cronJob.backoffMs },
      }),
    },
  );
};

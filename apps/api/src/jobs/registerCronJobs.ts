import { db } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { isValidHandlerName } from '#/jobs/handlers';
import { queue } from '#/jobs/queue';
import { JobType } from '#/jobs/types';

export const registerCronJobs = async (): Promise<void> => {
  const cronJobs = await db.cronJob.findMany({
    where: { enabled: true },
  });

  if (cronJobs.length === 0) {
    log.info('No enabled cron jobs to register', LogScope.job);
    return;
  }

  log.info(`Registering ${cronJobs.length} enabled cron jobs...`, LogScope.job);

  for (const cronJob of cronJobs) {
    if (!isValidHandlerName(cronJob.handler)) {
      log.warn(`Cron job "${cronJob.name}" has unknown handler: ${cronJob.handler} - skipping`, LogScope.job);
      continue;
    }

    try {
      await queue.add(
        cronJob.handler,
        {
          id: cronJob.id,
          type: JobType.cron,
          payload: cronJob.payload,
        },
        {
          repeat: { pattern: cronJob.pattern, jobId: cronJob.jobId },
          attempts: cronJob.maxAttempts,
          backoff: { type: 'exponential', delay: cronJob.backoffMs },
        },
      );
      log.info(`Registered cron: ${cronJob.name} (${cronJob.handler}) - ${cronJob.pattern}`, LogScope.job);
    } catch (error) {
      log.error(`Failed to register cron "${cronJob.name}": ${error}`, LogScope.job);
    }
  }
};

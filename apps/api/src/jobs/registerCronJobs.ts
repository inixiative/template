/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { buildJobData } from '#/jobs/buildJobData';
import { isValidHandlerName, jobHandlers } from '#/jobs/handlers';
import { withLanePriority } from '#/jobs/lanePriority';
import { queue as defaultQueue } from '#/jobs/queue';
import { type JobsQueue, JobType } from '#/jobs/types';

export const registerCronJobs = async (queue: JobsQueue = defaultQueue): Promise<void> => {
  const cronJobs = await db.cronJob.findMany({
    where: { enabled: true },
  });

  log.info(`Registering ${cronJobs.length} enabled cron jobs...`, LogScope.job);

  const registeredKeys = new Set<string>();
  let failed = false;

  for (const cronJob of cronJobs) {
    if (!isValidHandlerName(cronJob.handler)) {
      log.warn(
        `Cron job "${cronJob.name}" has unknown handler: ${cronJob.handler} - skipping`,
        LogScope.job,
      );
      continue;
    }

    try {
      const data = buildJobData(jobHandlers[cronJob.handler], {
        id: cronJob.id,
        type: JobType.cron,
        payload: cronJob.payload,
      });
      const job = await queue.add(
        cronJob.handler,
        data,
        withLanePriority(data, {
          repeat: { pattern: cronJob.pattern, jobId: cronJob.jobId },
          attempts: cronJob.maxAttempts,
          backoff: { type: 'exponential', delay: cronJob.backoffMs },
        }),
      );
      if (job?.repeatJobKey) registeredKeys.add(job.repeatJobKey);
      log.info(
        `Registered cron: ${cronJob.name} (${cronJob.handler}) - ${cronJob.pattern}`,
        LogScope.job,
      );
    } catch (error) {
      failed = true;
      log.error(`Failed to register cron "${cronJob.name}": ${error}`, LogScope.job);
    }
  }

  if (failed) return;
  await removeOrphanedRepeatables(queue, registeredKeys);
};

const removeOrphanedRepeatables = async (
  queue: JobsQueue,
  registeredKeys: Set<string>,
): Promise<void> => {
  for (const repeatable of await queue.getRepeatableJobs()) {
    if (registeredKeys.has(repeatable.key)) continue;
    await queue.removeRepeatableByKey(repeatable.key);
    log.info(
      `Removed orphaned cron repeatable: ${repeatable.name} - ${repeatable.pattern}`,
      LogScope.job,
    );
  }
};

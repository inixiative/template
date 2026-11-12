/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { CronJob } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import { queue } from '#/jobs/queue';
import { upsertCronJobScheduler } from '#/jobs/upsertCronJobScheduler';
import { withCronJobsLock } from '#/jobs/withCronJobsLock';
import { validateCronJob } from '#/modules/admin/cronJob/validations/validateCronJob';

const STARTUP_LOCK_WAIT_MS = 30_000;

export const registerCronJobs = (): Promise<void> =>
  withCronJobsLock(async (lock) => {
    const cronJobs = await db.cronJob.findMany({ where: { enabled: true } });
    log.info(`Registering ${cronJobs.length} enabled cron jobs...`, LogScope.job);

    const liveCronJobs: CronJob[] = [];
    const unschedulableIds: string[] = [];
    for (const cronJob of cronJobs) {
      try {
        validateCronJob(cronJob);
        liveCronJobs.push(cronJob);
      } catch (err) {
        log.error(
          `Turning off unschedulable cron "${cronJob.name}": ${(err as Error).message} - fix the row and re-enable it`,
          LogScope.job,
        );
        unschedulableIds.push(cronJob.id);
      }
    }

    if (unschedulableIds.length) {
      lock.assertHeld();
      await db.cronJob.updateManyAndReturn({
        where: { id: { in: unschedulableIds } },
        data: { enabled: false },
      });
    }

    for (const cronJob of liveCronJobs) {
      lock.assertHeld();
      await upsertCronJobScheduler(cronJob);
      log.info(
        `Registered cron: ${cronJob.name} (${cronJob.handler}) - ${cronJob.pattern}`,
        LogScope.job,
      );
    }

    const liveJobIds = new Set(liveCronJobs.map((cronJob) => cronJob.jobId));
    for (const scheduler of await queue.getJobSchedulers()) {
      if (liveJobIds.has(scheduler.key)) continue;
      lock.assertHeld();
      await queue.removeJobScheduler(scheduler.key);
      log.info(
        `Removed orphaned cron scheduler: ${scheduler.name} - ${scheduler.pattern}`,
        LogScope.job,
      );
    }
  }, STARTUP_LOCK_WAIT_MS);

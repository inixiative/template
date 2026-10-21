/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { CronJob } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import { cronJobScheduleProblem } from '#/jobs/cronJobScheduleProblem';
import { queue } from '#/jobs/queue';
import { upsertCronJobScheduler } from '#/jobs/upsertCronJobScheduler';
import { withCronJobsLock } from '#/jobs/withCronJobsLock';

const STARTUP_LOCK_WAIT_MS = 30_000;

const reconcileSchedulers = (): Promise<CronJob[]> =>
  withCronJobsLock(async (assertHeld) => {
    const cronJobs = await db.cronJob.findMany({ where: { enabled: true } });
    log.info(`Registering ${cronJobs.length} enabled cron jobs...`, LogScope.job);

    const unschedulable: CronJob[] = [];
    const liveJobIds = new Set<string>();
    for (const cronJob of cronJobs) {
      const problem = cronJobScheduleProblem(cronJob);
      if (problem) {
        log.error(
          `Turning off unschedulable cron "${cronJob.name}": ${problem} - fix the row and re-enable it`,
          LogScope.job,
        );
        unschedulable.push(cronJob);
        continue;
      }
      liveJobIds.add(cronJob.jobId);
      try {
        assertHeld();
        await upsertCronJobScheduler(cronJob);
        log.info(
          `Registered cron: ${cronJob.name} (${cronJob.handler}) - ${cronJob.pattern}`,
          LogScope.job,
        );
      } catch (error) {
        log.error(`Failed to register cron "${cronJob.name}": ${error}`, LogScope.job);
      }
    }

    // Also clears pre-scheduler md5-keyed repeatables; rolling back past this change double-fires until a worker on it boots.
    for (const scheduler of await queue.getJobSchedulers()) {
      if (liveJobIds.has(scheduler.key)) continue;
      assertHeld();
      await queue.removeJobScheduler(scheduler.key);
      log.info(
        `Removed orphaned cron scheduler: ${scheduler.name} - ${scheduler.pattern}`,
        LogScope.job,
      );
    }
    return unschedulable;
  }, STARTUP_LOCK_WAIT_MS);

export const registerCronJobs = async (): Promise<void> => {
  const unschedulable = await reconcileSchedulers();
  // After the lock is released: each update's cronJobSync hook takes the same lock to sync the row.
  for (const cronJob of unschedulable)
    await db.cronJob.update({ where: { id: cronJob.id }, data: { enabled: false } });
};

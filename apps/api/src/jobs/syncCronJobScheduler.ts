/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { CronJob } from '@template/db/generated/client/client';
import { queue } from '#/jobs/queue';
import { upsertCronJobScheduler } from '#/jobs/upsertCronJobScheduler';
import { withCronJobsLock } from '#/jobs/withCronJobsLock';

export const syncCronJobScheduler = (rowId: string, previousJobId?: string): Promise<void> =>
  withCronJobsLock(async (lock) => {
    const current: CronJob | null = await db.cronJob.findUnique({ where: { id: rowId } });
    if (previousJobId && previousJobId !== current?.jobId) {
      lock.assertHeld();
      await queue.removeJobScheduler(previousJobId);
    }
    if (!current) return;
    lock.assertHeld();
    if (current.enabled) await upsertCronJobScheduler(current);
    else await queue.removeJobScheduler(current.jobId);
  });

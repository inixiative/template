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

// Re-reads the row under the lock, so whichever sync runs last leaves the scheduler matching the committed row.
export const syncCronJobScheduler = (rowId: string, previousJobId?: string): Promise<void> =>
  withCronJobsLock(async (assertHeld) => {
    const current: CronJob | null = await db.cronJob.findUnique({ where: { id: rowId } });
    if (previousJobId && previousJobId !== current?.jobId) {
      assertHeld();
      await queue.removeJobScheduler(previousJobId);
    }
    if (!current) return;
    assertHeld();
    if (current.enabled) await upsertCronJobScheduler(current);
    else await queue.removeJobScheduler(current.jobId);
  });

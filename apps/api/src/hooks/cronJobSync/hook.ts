/**
 * @atlas
 * @kind hook
 * @partOf feature:cronJob, primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import type { HookOptions } from '@template/db';
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { CronJob } from '@template/db/generated/client/client';
import { ConcurrencyType } from '@template/shared/utils';
import { queue } from '#/jobs/queue';
import { withCronJobsLock } from '#/jobs/withCronJobsLock';

const removeSchedulerBeforeDelete = (jobId: string): Promise<void> =>
  withCronJobsLock(async (lock) => {
    lock.assertHeld();
    await queue.removeJobScheduler(jobId);
  });

export const registerCronJobSyncHook = () => {
  registerDbHook(
    'cronJobSync',
    'CronJob',
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.upsert, DbAction.delete],
    async (options: HookOptions) => {
      // Lazy: the handler registry imports handlers that emit through hooks — a static import cycles.
      const { validateCronJob } = await import(
        '#/modules/admin/cronJob/validations/validateCronJob'
      );
      const { syncCronJobScheduler } = await import('#/jobs/syncCronJobScheduler');
      const previous = (options.previous ?? null) as CronJob | null;

      if (options.action === DbAction.delete) {
        if (!previous) return;
        await removeSchedulerBeforeDelete(previous.jobId);
        db.onCommit(
          [() => syncCronJobScheduler(previous.id, previous.jobId)],
          ConcurrencyType.queue,
        );
        return;
      }

      const current = options.result as CronJob;
      if (current.enabled) validateCronJob(current);
      db.onCommit([() => syncCronJobScheduler(current.id, previous?.jobId)], ConcurrencyType.queue);
    },
  );
};

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
import { buildJobData } from '#/jobs/buildJobData';
import { withLanePriority } from '#/jobs/lanePriority';
import { queue } from '#/jobs/queue';
import { JobType } from '#/jobs/types';

// Reflect CronJob row changes into BullMQ so admin edits apply without a worker
// restart. Runs after commit via db.onCommit — if BullMQ work fails, the DB
// write isn't poisoned (per webhooks / cache hook convention).

const syncToBullMQ = (prev: CronJob | null, curr: CronJob | null) => async () => {
  if (prev) await queue.removeRepeatable(prev.handler, { pattern: prev.pattern, jobId: prev.jobId });
  if (curr?.enabled) {
    // Lazy: the handler registry imports handlers that emit through hooks — a static import cycles.
    const { isValidHandlerName, jobHandlers } = await import('#/jobs/handlers');
    const handler = isValidHandlerName(curr.handler) ? jobHandlers[curr.handler] : {};
    const data = buildJobData(handler, { id: curr.id, type: JobType.cron, payload: curr.payload });
    await queue.add(
      curr.handler,
      data,
      withLanePriority(data, {
        jobId: curr.jobId,
        repeat: { pattern: curr.pattern },
        attempts: curr.maxAttempts,
        backoff: { type: 'exponential', delay: curr.backoffMs },
      }),
    );
  }
};

export const registerCronJobSyncHook = () => {
  registerDbHook(
    'cronJobSync',
    'CronJob',
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.delete],
    async (options: HookOptions) => {
      const prev = (options.previous ?? null) as CronJob | null;
      const curr = options.action === DbAction.delete ? null : ((options.result ?? null) as CronJob | null);
      db.onCommit([syncToBullMQ(prev, curr)], ConcurrencyType.queue);
    },
  );
};

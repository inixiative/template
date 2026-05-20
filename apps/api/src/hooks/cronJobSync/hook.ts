import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { CronJob } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import { isValidHandlerName } from '#/jobs/handlers';
import { queue } from '#/jobs/queue';
import { JobType } from '#/jobs/types';

// Live BullMQ sync for CronJob mutations. Without this, edits to a CronJob row
// (toggle enabled, change pattern, swap payload) only take effect on the next
// worker restart — registerCronJobs runs once at boot. The hook keeps BullMQ
// in step so admin UI changes apply immediately.

const removeRepeatable = async (cronJob: CronJob): Promise<void> => {
  await queue
    .removeRepeatable(cronJob.handler, { pattern: cronJob.pattern, jobId: cronJob.jobId })
    .catch((err: unknown) => log.warn(`removeRepeatable failed for ${cronJob.name}: ${String(err)}`, LogScope.job));
};

const addRepeatable = async (cronJob: CronJob): Promise<void> => {
  if (!cronJob.enabled) return;
  if (!isValidHandlerName(cronJob.handler)) {
    log.warn(`Cron sync skipped — unknown handler ${cronJob.handler} on ${cronJob.name}`, LogScope.job);
    return;
  }
  await queue.add(
    cronJob.handler,
    { id: cronJob.id, type: JobType.cron, payload: cronJob.payload },
    {
      jobId: cronJob.jobId,
      repeat: { pattern: cronJob.pattern },
      attempts: cronJob.maxAttempts,
      backoff: { type: 'exponential', delay: cronJob.backoffMs },
    },
  );
  log.info(`Cron synced: ${cronJob.name} (${cronJob.handler}) - ${cronJob.pattern}`, LogScope.job);
};

export const registerCronJobSyncHook = (): void => {
  registerDbHook(
    'cronJobSync',
    'CronJob',
    HookTiming.after,
    [DbAction.create, DbAction.update, DbAction.delete],
    async (options: HookOptions) => {
      const { action } = options;

      if (action === DbAction.create) {
        const created = (options.result ?? {}) as CronJob;
        await addRepeatable(created);
        return;
      }

      if (action === DbAction.update) {
        const updated = (options.result ?? {}) as CronJob;
        const previous = (options.previous ?? updated) as CronJob;
        // Always remove the previous, then re-add if enabled. Re-adding from
        // scratch handles pattern/payload/handler/jobId changes uniformly —
        // BullMQ's repeatable key is derived from those, so a "modify"
        // requires drop + add anyway.
        await removeRepeatable(previous);
        await addRepeatable(updated);
        return;
      }

      if (action === DbAction.delete) {
        const deleted = (options.previous ?? options.result ?? {}) as CronJob;
        await removeRepeatable(deleted);
        return;
      }
    },
  );
};

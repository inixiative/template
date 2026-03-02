import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { JobHandler } from '#/jobs/types';

/**
 * Clean Stale Webhook Events
 *
 * Removes webhook event records older than 90 days.
 * Runs nightly to prevent unbounded growth of webhook history.
 */
export const cleanStaleWebhooks: JobHandler<void> = makeSingletonJob(async (ctx) => {
  const { db, log } = ctx;

  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  const result = await db.webhookEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  log(`Deleted ${result.count} webhook events older than 90 days`);
});

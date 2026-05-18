import { log } from '@template/shared/logger';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { JobHandler } from '#/jobs/types';

export const cleanStaleWebhooks: JobHandler<void> = makeSingletonJob(async (ctx) => {
  const { db } = ctx;

  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  const result = await db.webhookEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  log.info(`Deleted ${result.count} webhook events older than 90 days`);
});

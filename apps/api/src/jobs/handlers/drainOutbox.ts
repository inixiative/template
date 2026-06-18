/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { log } from '@template/shared/logger';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { clearOverflow, LOW_WATER, MAX_QUEUE_DEPTH, queueDepth } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import type { JobData, JobOptions, WorkerContext } from '#/jobs/types';

// Meters JobOutbox rows back into BullMQ, topping the queue up to the cap each tick.
// Singleton (createLock) so only one drainer runs — hence a plain select, no FOR UPDATE.
// Re-enqueues with the stored jobId: BullMQ dedup is the exactly-once fence if the drainer
// crashes between add and delete. One CronJob row drives the cadence.

export const drainOutbox = makeSingletonJob(async (ctx: WorkerContext) => {
  const { db } = ctx;

  const room = MAX_QUEUE_DEPTH - (await queueDepth(true));
  if (room <= 0) return;

  const rows = await db.jobOutbox.findMany({ orderBy: { id: 'asc' }, take: room });
  if (rows.length) {
    for (const row of rows) {
      await queue.add(row.handlerName, row.data as JobData, {
        ...(row.options as JobOptions | null),
        jobId: row.jobId,
      });
    }
    await db.jobOutbox.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    log.info(`drainOutbox: admitted ${rows.length} buffered jobs`);
  }

  if ((await queueDepth(true)) < LOW_WATER) await clearOverflow();
});

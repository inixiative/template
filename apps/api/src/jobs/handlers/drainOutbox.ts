/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import { clearOverflow, lowWater, maxQueueDepth, queueDepth, runOnOutboxQueue, signalSupersededJobs } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import type { JobData, JobOptions, WorkerContext } from '#/jobs/types';

// Meters JobOutbox rows back into BullMQ, topping the queue up to the cap each tick.
// Singleton (createLock) so only one drainer runs across processes; the table read+delete
// runs through the shared outbox mutex so it can't interleave with an accumulator flush.
//
// AT-LEAST-ONCE: a crash between queue.add and the row delete re-admits the row next tick.
// The stored jobId dedups a replay only while it's still in Redis (removeOnComplete evicts
// it), so job handlers MUST be idempotent. Superseding rows are re-signalled and added
// without a fixed jobId, matching the direct enqueue path.

export const drainOutbox = makeSingletonJob(async (ctx: WorkerContext) => {
  const { db } = ctx;

  const room = maxQueueDepth() - (await queueDepth(true));
  if (room > 0) {
    await runOnOutboxQueue(async () => {
      const rows = await db.jobOutbox.findMany({ orderBy: { id: 'asc' }, take: room });
      const drained: string[] = [];

      for (const row of rows) {
        try {
          const data = row.data as JobData;
          const opts = (row.options as JobOptions | null) ?? {};
          if (data.dedupeKey) {
            await signalSupersededJobs(data.dedupeKey); // abort any in-flight prior, like the direct path
            await queue.add(row.handlerName, data, opts); // no fixed jobId — supersession governed by the abort flag
          } else {
            await queue.add(row.handlerName, data, { ...opts, jobId: row.jobId });
          }
          drained.push(row.id);
        } catch (e) {
          // One poison row must not strand the batch; it stays buffered and surfaces here each tick.
          log.error(`drainOutbox: failed to re-enqueue ${row.handlerName} (${row.jobId})`, e, LogScope.job);
        }
      }

      if (drained.length) {
        await db.jobOutbox.deleteMany({ where: { id: { in: drained } } });
        log.info(`drainOutbox: admitted ${drained.length}/${rows.length} buffered jobs`, LogScope.job);
      }
    });
  }

  if ((await queueDepth(true)) < lowWater()) await clearOverflow();
});

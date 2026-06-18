/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { LogScope, log } from '@template/shared/logger';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import {
  clearOverflow,
  isOverflowing,
  lowWater,
  maxQueueDepth,
  queueDepth,
  renewOverflow,
  runOnOutboxQueue,
  signalSupersededJobs,
  warnIfOverflowStuck,
} from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import type { JobData, JobOptions, WorkerContext } from '#/jobs/types';

// Meters JobOutbox rows back into BullMQ, topping the queue up to the cap each tick.
// Singleton (createLock) so only one drainer runs across processes. The whole admit pass runs
// through the shared outbox mutex (runOnOutboxQueue) so it never interleaves with an accumulator
// flush — deliberately held across the queue.add loop too, which briefly blocks this process's
// flushes during a large drain. That's an accepted, self-recovering stall, not a correctness issue.
//
// AT-LEAST-ONCE: a crash between queue.add and the row delete re-admits the row next tick.
// The stored jobId dedups a replay only while it's still in Redis (removeOnComplete evicts
// it), so job handlers MUST be idempotent. Superseding rows are re-signalled and added
// without a fixed jobId, matching the direct enqueue path.
//
// Supersession through the buffer is tick-granular + last-wins: the drain cancels prior copies
// and re-admits the latest, but a stale copy can run before the next tick cancels its successor.
// Superseding handlers are idempotent / last-wins by design, so a re-run is harmless — same
// requirement as the at-least-once drain. A strict "never re-run" lane would need a per-enqueue
// claim registry; not built, not needed here.

export const drainOutbox = makeSingletonJob(async (ctx: WorkerContext) => {
  const { db } = ctx;

  // Renew the flag up front so a long admit pass can't let its TTL lapse mid-tick.
  if (await isOverflowing()) await renewOverflow();

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

  const depth = await queueDepth(true);
  if (depth < lowWater()) {
    await clearOverflow();
  } else {
    await renewOverflow(); // still overflowing — keep the flag alive past the next tick
    await warnIfOverflowStuck(depth); // alert if it's been stuck on — drain isn't keeping up
  }
});

/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { JobsOptions } from 'bullmq';
import { claimLane, laneKey } from '#/jobs/lanes';
import { lowWater, maxQueueDepth } from '#/jobs/outbox/config';
import { clearOverflow, warnIfOverflowStuck, withOverflowRenew } from '#/jobs/outbox/flag';
import { runOnOutboxQueue } from '#/jobs/outbox/mutex';
import { queueDepth } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import type { JobData } from '#/jobs/types';

// A row that fails re-enqueue this many times is quarantined (skipped) so it can't block newer rows.
const MAX_DRAIN_ATTEMPTS = 5;

export const runDrainOutboxPass = async (): Promise<void> => {
  await withOverflowRenew(async () => {
    const room = maxQueueDepth() - (await queueDepth(true));
    if (room > 0) {
      await runOnOutboxQueue(async () => {
        const rows = await db.jobOutbox.findMany({
          where: { attempts: { lt: MAX_DRAIN_ATTEMPTS } },
          orderBy: { id: 'asc' }, // uuidv7 id is time-ordered → FIFO
          take: room,
        });

        const drained: string[] = [];
        const failed: string[] = [];
        for (const row of rows) {
          try {
            const data = row.data as JobData;
            const opts = (row.options ?? {}) as JobsOptions;
            await queue.add(row.handlerName, data, { ...opts, jobId: row.jobId });
            if (data.dedupeKey) await claimLane(laneKey(row.handlerName, data.dedupeKey), row.jobId);
            drained.push(row.id);
          } catch (e) {
            failed.push(row.id);
            log.error(
              `drainOutbox: failed to re-enqueue ${row.handlerName} (${row.jobId}) — attempt ${row.attempts + 1}`,
              e,
              LogScope.job,
            );
          }
        }

        if (drained.length) {
          await db.jobOutbox.deleteMany({ where: { id: { in: drained } } });
          log.info(`drainOutbox: admitted ${drained.length}/${rows.length} buffered jobs`, LogScope.job);
        }
        if (failed.length) {
          // updateManyAndReturn, not updateMany — the mutationLifeCycle extension bans the bare form.
          await db.jobOutbox.updateManyAndReturn({
            where: { id: { in: failed } },
            data: { attempts: { increment: 1 } },
          });
          log.warn(
            `drainOutbox: ${failed.length} row(s) failed re-enqueue (quarantine at ${MAX_DRAIN_ATTEMPTS})`,
            LogScope.job,
          );
        }
      });
    }

    const depth = await queueDepth(true);
    if (depth < lowWater()) {
      // clear only with no admittable backlog left, else a fresh enqueue jumps the buffered FIFO
      const admittable = await db.jobOutbox.count({ where: { attempts: { lt: MAX_DRAIN_ATTEMPTS } } });
      if (admittable === 0) {
        await db.jobOutbox.updateManyAndReturn({
          where: { attempts: { gte: MAX_DRAIN_ATTEMPTS } },
          data: { attempts: 0 },
        });
        await clearOverflow();
      }
    } else await warnIfOverflowStuck(depth);
  });
};

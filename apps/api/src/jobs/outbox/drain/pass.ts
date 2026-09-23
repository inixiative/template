/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { claimLane, db, getJobSupersededBy, laneKey, releaseLane } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { JobsOptions } from 'bullmq';
import { hasPendingFastSpills, hasPendingSpills } from '#/jobs/outbox/accumulator';
import { lowWater, MAX_DRAIN_ATTEMPTS, maxQueueDepth, maxSlowAdmissions } from '#/jobs/outbox/config';
import { clearOverflow, warnIfOverflowStuck, withOverflowRenew } from '#/jobs/outbox/flag';
import { runOnOutboxQueue } from '#/jobs/outbox/mutex';
import { queueDepth } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import { admitNextSlowOutboxRow } from '#/jobs/slowLane/admitNextSlowOutboxRow';
import { bulkCapacity } from '#/jobs/slowLane/capacity';
import { type JobData, JobLane } from '#/jobs/types';
import { isValidJobId } from '#/jobs/validateJobId';

// Slow rows are the backstop path here: a finishing slow job admits the next one itself. The drain
// covers what that misses — rows buffered while no slow job was running, crashed workers, expired
// reservations — bounded by queue room, the per-pass cap, and the slots free right now.
const admitSlowRows = async (queueRoom: number): Promise<number> => {
  if (queueRoom <= 0) return 0;
  const capacity = await bulkCapacity(queue.redis);
  const slowRoom = Math.min(queueRoom, maxSlowAdmissions(), Math.max(0, capacity.cap - capacity.occupied));
  let admitted = 0;
  for (let attempt = 0; attempt < slowRoom; attempt++) {
    const result = await admitNextSlowOutboxRow();
    if (result === 'admitted') admitted++;
    if (result === 'empty' || result === 'noSlot') break;
  }
  if (admitted) log.info(`drainOutbox: admitted ${admitted} slow-lane row(s)`, LogScope.job);
  return admitted;
};

export const runDrainOutboxPass = async (): Promise<void> => {
  await withOverflowRenew(async () => {
    const room = maxQueueDepth() - (await queueDepth(true));
    let fastAdmitted = 0;
    if (room > 0) {
      await runOnOutboxQueue(async () => {
        const rows = await db.jobOutbox.findMany({
          where: { lane: JobLane.fast, attempts: { lt: MAX_DRAIN_ATTEMPTS } },
          orderBy: { id: 'asc' }, // uuidv7 id is time-ordered → FIFO
          take: room,
        });

        const drained: string[] = [];
        const displaced: string[] = [];
        const failed: string[] = [];
        for (const row of rows) {
          const data = row.data as JobData;
          const opts = (row.options ?? {}) as JobsOptions;
          const lane = data.dedupeKey ? laneKey(row.handlerName, data.dedupeKey) : undefined;
          // Rows buffered before enqueue validated custom ids would otherwise fail every re-add and
          // quarantine deliverable work; admission mints a replacement instead.
          const jobId = isValidJobId(row.jobId) ? row.jobId : Bun.randomUUIDv7();
          let previousHolder: string | null = null;
          try {
            // A row tombstoned while buffered was displaced by a newer direct enqueue. Re-claiming it
            // would tombstone the usurper right back (mutual tombstones → neither runs), so drop it.
            if (lane && (await getJobSupersededBy(row.jobId))) {
              displaced.push(row.id);
              continue;
            }
            if (jobId !== row.jobId) {
              log.info(`drainOutbox: replaced invalid buffered job id ${row.jobId} with ${jobId}`, LogScope.job);
            }
            // Claim TTL stretches by the re-added job's delay, same as the direct enqueue path.
            if (lane) previousHolder = await claimLane(lane, jobId, opts.delay);
            await queue.add(row.handlerName, data, { ...opts, jobId });
            drained.push(row.id);
          } catch (e) {
            // The re-add failed, so roll back the lane claim (fenced) — the row stays buffered for a
            // retry; don't leave the prior job superseded by a job that never got created. A self-claim
            // (the spill-time baton, previousHolder === jobId) must survive the retry — keep it.
            if (lane && previousHolder !== jobId) {
              await releaseLane(lane, jobId, previousHolder).catch(() => {});
            }
            failed.push(row.id);
            log.error(
              `drainOutbox: failed to re-enqueue ${row.handlerName} (${jobId}) — attempt ${row.attempts + 1}`,
              e,
              LogScope.job,
            );
          }
        }

        fastAdmitted = drained.length;
        if (drained.length || displaced.length) {
          await db.jobOutbox.deleteMany({ where: { id: { in: [...drained, ...displaced] } } });
          if (drained.length) {
            log.info(`drainOutbox: admitted ${drained.length}/${rows.length} buffered jobs`, LogScope.job);
          }
          if (displaced.length) {
            log.info(`drainOutbox: dropped ${displaced.length} superseded buffered row(s)`, LogScope.job);
          }
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
    await admitSlowRows(room - fastAdmitted);

    const depth = await queueDepth(true);
    if (depth < lowWater()) {
      // Counted, reset, and cleared under the outbox mutex so a flush can't commit a row between them.
      await runOnOutboxQueue(async () => {
        const [fastAdmittable, slowAdmittable] = await Promise.all(
          [JobLane.fast, JobLane.slow].map((lane) =>
            db.jobOutbox.count({ where: { lane, attempts: { lt: MAX_DRAIN_ATTEMPTS } } }),
          ),
        );
        // Quarantined rows get another chance only on full recovery: no admittable row in either lane.
        if (fastAdmittable === 0 && slowAdmittable === 0 && !hasPendingSpills()) {
          await db.jobOutbox.updateManyAndReturn({
            where: { attempts: { gte: MAX_DRAIN_ATTEMPTS } },
            data: { attempts: 0 },
          });
        }
        // The flag protects queue room, which only fast rows wait for. Clear it with any fast backlog
        // left and a fresh enqueue jumps the buffered FIFO; slow rows waiting for a slot don't hold it.
        if (fastAdmittable === 0 && !hasPendingFastSpills()) await clearOverflow();
      });
    } else await warnIfOverflowStuck(depth);
  });
};

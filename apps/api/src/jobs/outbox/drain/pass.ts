/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { claimLane, db, getJobSupersededBy, laneKey, releaseLane } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import type { JobsOptions } from 'bullmq';
import { withLanePriority } from '#/jobs/lanePriority';
import { hasPendingFastSpills, hasPendingSlowSpills, hasPendingSpills } from '#/jobs/outbox/accumulator';
import { laneDepthCap, lowWater, MAX_DRAIN_ATTEMPTS } from '#/jobs/outbox/config';
import { clearOverflow, warnIfOverflowStuck, withOverflowRenew } from '#/jobs/outbox/flag';
import { runOnOutboxQueue } from '#/jobs/outbox/mutex';
import { laneDepth, type QueueDepths, queueDepths } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import { type JobData, JobLane } from '#/jobs/types';
import { isValidJobId } from '#/jobs/validateJobId';

// Meter one lane's buffered rows back into BullMQ, oldest first, up to `room`: one read, one add per
// row, one delete for the batch. Slow rows re-enter at the slow lane's priority.
const admitLaneRows = async (lane: JobLane, room: number): Promise<number> => {
  if (room <= 0) return 0;
  return runOnOutboxQueue(async () => {
    const rows = await db.jobOutbox.findMany({
      where: { lane, attempts: { lt: MAX_DRAIN_ATTEMPTS } },
      orderBy: { id: 'asc' }, // uuidv7 id is time-ordered → FIFO
      take: room,
    });

    const drained: string[] = [];
    const displaced: string[] = [];
    const failed: string[] = [];
    for (const row of rows) {
      const data = row.data as JobData;
      const opts = withLanePriority({ lane }, (row.options ?? {}) as JobsOptions);
      const baton = data.dedupeKey ? laneKey(row.handlerName, data.dedupeKey) : undefined;
      // Rows buffered before enqueue validated custom ids would otherwise fail every re-add and
      // quarantine deliverable work; admission mints a replacement instead.
      const jobId = isValidJobId(row.jobId) ? row.jobId : Bun.randomUUIDv7();
      let previousHolder: string | null = null;
      try {
        // A row tombstoned while buffered was displaced by a newer direct enqueue. Re-claiming it
        // would tombstone the usurper right back (mutual tombstones → neither runs), so drop it.
        if (baton && (await getJobSupersededBy(row.jobId))) {
          displaced.push(row.id);
          continue;
        }
        if (jobId !== row.jobId) {
          log.info(`drainOutbox: replaced invalid buffered job id ${row.jobId} with ${jobId}`, LogScope.job);
        }
        // Claim TTL stretches by the re-added job's delay, same as the direct enqueue path.
        if (baton) previousHolder = await claimLane(baton, jobId, opts.delay);
        await queue.add(row.handlerName, data, { ...opts, jobId });
        drained.push(row.id);
      } catch (e) {
        // The re-add failed, so roll back the lane claim (fenced) — the row stays buffered for a
        // retry; don't leave the prior job superseded by a job that never got created. A self-claim
        // (the spill-time baton, previousHolder === jobId) must survive the retry — keep it.
        if (baton && previousHolder !== jobId) {
          await releaseLane(baton, jobId, previousHolder).catch(() => {});
        }
        failed.push(row.id);
        log.error(
          `drainOutbox: failed to re-enqueue ${row.handlerName} (${jobId}) — attempt ${row.attempts + 1}`,
          e,
          LogScope.job,
        );
      }
    }

    if (drained.length || displaced.length) {
      await db.jobOutbox.deleteMany({ where: { id: { in: [...drained, ...displaced] } } });
      if (drained.length) {
        log.info(`drainOutbox: admitted ${drained.length}/${rows.length} buffered ${lane} jobs`, LogScope.job);
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
    return drained.length;
  });
};

const settleFlags = async (depths: QueueDepths): Promise<void> => {
  const belowLowWater = (lane: JobLane) => laneDepth(depths, lane) < lowWater(lane);
  if (!belowLowWater(JobLane.fast) && !belowLowWater(JobLane.slow)) {
    await warnIfOverflowStuck(JobLane.fast, depths.total);
    await warnIfOverflowStuck(JobLane.slow, depths.slow);
    return;
  }
  // Counted, reset, and cleared under the outbox mutex so a flush can't commit a row between them.
  await runOnOutboxQueue(async () => {
    const [fastAdmittable, slowAdmittable] = await Promise.all(
      [JobLane.fast, JobLane.slow].map((lane) =>
        db.jobOutbox.count({ where: { lane, attempts: { lt: MAX_DRAIN_ATTEMPTS } } }),
      ),
    );
    // Quarantined rows get another chance only on full recovery: the queue healthy and no admittable
    // row in either lane.
    if (belowLowWater(JobLane.fast) && fastAdmittable === 0 && slowAdmittable === 0 && !hasPendingSpills()) {
      await db.jobOutbox.updateManyAndReturn({
        where: { attempts: { gte: MAX_DRAIN_ATTEMPTS } },
        data: { attempts: 0 },
      });
    }
    // Each lane's flag clears below its own low-water once none of its rows wait — clearing earlier
    // would let a fresh enqueue jump that lane's buffered FIFO.
    if (belowLowWater(JobLane.fast) && fastAdmittable === 0 && !hasPendingFastSpills()) {
      await clearOverflow(JobLane.fast);
    }
    if (belowLowWater(JobLane.slow) && slowAdmittable === 0 && !hasPendingSlowSpills()) {
      await clearOverflow(JobLane.slow);
    }
  });
  if (!belowLowWater(JobLane.fast)) await warnIfOverflowStuck(JobLane.fast, depths.total);
  if (!belowLowWater(JobLane.slow)) await warnIfOverflowStuck(JobLane.slow, depths.slow);
};

export const runDrainOutboxPass = async (): Promise<void> => {
  await withOverflowRenew(async () => {
    const depths = await queueDepths(true);
    const room = laneDepthCap(JobLane.fast) - depths.total;
    const fastAdmitted = await admitLaneRows(JobLane.fast, room);
    const slowRoom = Math.min(room - fastAdmitted, laneDepthCap(JobLane.slow) - depths.slow);
    await admitLaneRows(JobLane.slow, slowRoom);

    await settleFlags(await queueDepths(true));
  });
};

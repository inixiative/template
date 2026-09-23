/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { claimLane, db, getJobSupersededBy, laneKey, releaseLane } from '@template/db';
import type { JobOutbox } from '@template/db/generated/client/client';
import { LogScope, log } from '@template/shared/logger';
import type { JobsOptions } from 'bullmq';
import { MAX_DRAIN_ATTEMPTS } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { claimBulkSlot, releaseBulkSlot } from '#/jobs/slowLane/capacity';
import { type JobData, JobLane } from '#/jobs/types';
import { isValidJobId } from '#/jobs/validateJobId';

export type SlowAdmission = 'admitted' | 'empty' | 'noSlot' | 'superseded' | 'failed';

const lockOldestSlowRow = async (): Promise<JobOutbox | undefined> => {
  const [row] = await db.findForUpdate<JobOutbox>(
    'JobOutbox',
    { lane: JobLane.slow, attempts: { lt: MAX_DRAIN_ATTEMPTS } },
    { orderBy: { id: 'asc' }, take: 1, skipLocked: true },
  );
  return row;
};

export const admitNextSlowOutboxRow = (): Promise<SlowAdmission> =>
  db.txn(async () => {
    const row = await lockOldestSlowRow();
    if (!row) return 'empty';

    const data = row.data as JobData;
    const options = (row.options ?? {}) as JobsOptions;
    const lane = data.dedupeKey ? laneKey(row.handlerName, data.dedupeKey) : undefined;

    if (lane && (await getJobSupersededBy(row.jobId))) {
      await db.jobOutbox.delete({ where: { id: row.id } });
      return 'superseded';
    }

    const jobId = isValidJobId(row.jobId) ? row.jobId : Bun.randomUUIDv7();
    if (jobId !== row.jobId) {
      log.info(`Slow admission replaced invalid buffered job id ${row.jobId} with ${jobId}`, LogScope.job);
    }

    const capacity = await claimBulkSlot(queue.redis, jobId);
    if (!capacity.claimed) return 'noSlot';

    let previousHolder: string | null = null;
    try {
      if (lane) previousHolder = await claimLane(lane, jobId, options.delay);
      await queue.add(row.handlerName, data, { ...options, jobId });
    } catch (err) {
      if (lane && previousHolder !== jobId) await releaseLane(lane, jobId, previousHolder).catch(() => {});
      await releaseBulkSlot(queue.redis, jobId).catch(() => {});
      await db.jobOutbox.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      log.error(
        `Slow admission failed to re-enqueue ${row.handlerName} (${jobId}) — attempt ${row.attempts + 1}`,
        err,
        LogScope.job,
      );
      return 'failed';
    }

    await db.jobOutbox.delete({ where: { id: row.id } });
    return 'admitted';
  });

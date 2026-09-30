/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:observability
 */
import { LogScope, log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';
import { DelayedError, type Job, WaitingError } from 'bullmq';
import { isSlowJobData } from '#/jobs/buildJobData';
import { queueDepths } from '#/jobs/outbox/queueDepth';
import { recordSlowDeferral, releaseSlowDeferral, slowParkDelayMs } from '#/jobs/slowLaneSignals';
import type { SlowSlotPool } from '#/jobs/slowSlotPool';
import type { JobsQueue } from '#/jobs/types';

export type ReleaseSlot = () => void;

const hasJumpedFastWork = async (job: Job, queue: JobsQueue): Promise<boolean> =>
  (job.priority ?? 0) > 0 && (await queue.getWaitingCount()) > 0;

const trackDeferral = async (write: () => Promise<void>, jobId: string | undefined): Promise<void> => {
  try {
    await write();
  } catch (err) {
    log.warn('Failed to update the slow-lane deferral list', { err, jobId }, LogScope.worker);
  }
};

export const admitToSlot = async (job: Job, queue: JobsQueue, slowSlots: SlowSlotPool): Promise<ReleaseSlot> => {
  const isSlow = isSlowJobData(job.data);
  const jobId = job.id ?? '';
  if (await hasJumpedFastWork(job, queue)) {
    if (isSlow) await trackDeferral(() => releaseSlowDeferral(queue.redis, queue.name, jobId), job.id);
    await job.moveToWait(job.token);
    throw new WaitingError();
  }
  if (!isSlow) return () => {};
  if (!slowSlots.tryHold()) {
    const dueAt = Date.now() + slowParkDelayMs((await queueDepths()).slow);
    await trackDeferral(() => recordSlowDeferral(queue.redis, queue.name, jobId, dueAt), job.id);
    await job.moveToDelayed(dueAt, job.token);
    incrementCounter('jobs.slow.parked', 1, { 'messaging.destination.name': queue.name });
    throw new DelayedError();
  }
  await trackDeferral(() => releaseSlowDeferral(queue.redis, queue.name, jobId), job.id);
  return slowSlots.release;
};

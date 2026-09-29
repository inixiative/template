/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { DelayedError, type Job, WaitingError } from 'bullmq';
import { isSlowJobData } from '#/jobs/buildJobData';
import type { SlowSlotPool } from '#/jobs/slowSlotPool';
import type { JobsQueue } from '#/jobs/types';

export const SLOW_SLOT_RETRY_MS = 1000;

export type ReleaseSlot = () => void;

const hasJumpedFastWork = async (job: Job, queue: JobsQueue): Promise<boolean> =>
  (job.priority ?? 0) > 0 && (await queue.getWaitingCount()) > 0;

export const admitToSlot = async (job: Job, queue: JobsQueue, slowSlots: SlowSlotPool): Promise<ReleaseSlot> => {
  if (await hasJumpedFastWork(job, queue)) {
    await job.moveToWait(job.token);
    throw new WaitingError();
  }
  if (!isSlowJobData(job.data)) return () => {};
  if (!slowSlots.tryHold()) {
    await job.moveToDelayed(Date.now() + SLOW_SLOT_RETRY_MS, job.token);
    throw new DelayedError();
  }
  return slowSlots.release;
};

/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */
import type { Job } from 'bullmq';

// why: mirrors BullMQ's own retry test (`attemptsMade + 1 < opts.attempts`); no `attempts` means one.
export const isFinalAttempt = (job: Pick<Job, 'attemptsMade' | 'opts'>): boolean =>
  job.attemptsMade + 1 >= (job.opts?.attempts ?? 1);

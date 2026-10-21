/**
 * @atlas
 * @kind helper
 * @partOf primitive:jobs, feature:cronJob, mutex
 * @uses infrastructure:redis
 */
import { createLock } from '@template/db';
import { makeError } from '#/lib/errors';

const CRON_JOBS_LOCK = {
  service: 'cronJobs',
  identifier: 'schedulers',
  ttlMs: 30_000,
  heartbeatMs: 10_000,
};
export const CRON_JOBS_ADMIN_WAIT_MS = 5_000;

export const withCronJobsLock = async <T>(
  fn: (assertHeld: () => void) => Promise<T>,
  waitMs: number = CRON_JOBS_ADMIN_WAIT_MS,
): Promise<T> => {
  const lock = createLock(CRON_JOBS_LOCK);
  await lock.acquire({
    waitMs,
    onTimeout: () =>
      makeError({ status: 409, message: 'Cron schedules are being reconciled; please retry' }),
  });
  const assertHeld = (): void => {
    if (!lock.isWithinLease())
      throw makeError({ status: 409, message: 'Lost the cron schedules lock; please retry' });
  };
  try {
    return await fn(assertHeld);
  } finally {
    await lock.release();
  }
};

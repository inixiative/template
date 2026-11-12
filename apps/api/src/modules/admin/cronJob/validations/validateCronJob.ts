/**
 * @atlas
 * @kind validator
 * @partOf feature:cronJob, primitive:jobs
 * @uses none
 */
import type { CronJob } from '@template/db/generated/client/client';
import { defaultRepeatStrategy } from 'bullmq';
import { isValidHandlerName } from '#/jobs/handlers';
import { validateJobId } from '#/jobs/validateJobId';
import { makeError } from '#/lib/errors';

export const validateCronJob = (cronJob: Pick<CronJob, 'jobId' | 'handler' | 'pattern'>): void => {
  try {
    validateJobId(cronJob.jobId);
  } catch (err) {
    throw makeError({ status: 422, message: (err as Error).message });
  }
  if (!isValidHandlerName(cronJob.handler))
    throw makeError({ status: 422, message: `Unknown job handler: "${cronJob.handler}"` });
  let nextRun: number | undefined;
  try {
    nextRun = defaultRepeatStrategy(Date.now(), { pattern: cronJob.pattern });
  } catch (err) {
    throw makeError({
      status: 422,
      message: `Cron pattern "${cronJob.pattern}" is invalid: ${(err as Error).message}`,
    });
  }
  if (nextRun === undefined)
    throw makeError({ status: 422, message: `Cron pattern "${cronJob.pattern}" never runs` });
};

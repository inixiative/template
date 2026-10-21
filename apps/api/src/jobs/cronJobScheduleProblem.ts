/**
 * @atlas
 * @kind validator
 * @partOf primitive:jobs, feature:cronJob
 * @uses none
 */
import type { CronJob } from '@template/db/generated/client/client';
import { defaultRepeatStrategy } from 'bullmq';
import { isValidHandlerName } from '#/jobs/handlers';
import { validateJobId } from '#/jobs/validateJobId';

// defaultRepeatStrategy is what BullMQ runs to compute the next tick, so this accepts exactly what the scheduler does.
export const cronJobScheduleProblem = (
  cronJob: Pick<CronJob, 'jobId' | 'handler' | 'pattern'>,
): string | undefined => {
  try {
    validateJobId(cronJob.jobId);
  } catch (err) {
    return (err as Error).message;
  }
  if (!isValidHandlerName(cronJob.handler)) return `Unknown job handler: "${cronJob.handler}"`;
  try {
    if (defaultRepeatStrategy(Date.now(), { pattern: cronJob.pattern }) === undefined)
      return `Cron pattern "${cronJob.pattern}" never runs`;
  } catch (err) {
    return `Cron pattern "${cronJob.pattern}" is invalid: ${(err as Error).message}`;
  }
  return undefined;
};

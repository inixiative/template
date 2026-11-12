/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:redis
 */
import { enqueueJob } from '#/jobs/enqueue';
import type { JobPayloads } from '#/jobs/handlers';
import { type JobLane, type JobOptions, JobType } from '#/jobs/types';

export type CronRun = {
  handlerName: string;
  cronJobId?: string;
  payload: unknown;
  lane?: JobLane;
  attempts?: number;
  backoff?: JobOptions['backoff'];
};

// The real run of a cron row. A cron tick (the BullMQ repeatable, see processJob) and a manual trigger
// (triggerCronJob) both enqueue it here instead of running the handler, as a `cronTrigger` job carrying
// the row id. So a scheduled run and a manual trigger collide like any two enqueues of that handler: a
// singleton skips while a run for the row exists (deduplicated on the row), a superseding job takes
// over. A repeatable's job template cannot carry a deduplication id, which is why the tick hands off.
// The row's attempts and backoff travel with the run, so its retries stay what the row says.
export const enqueueCronRun = async ({
  handlerName,
  cronJobId,
  payload,
  lane,
  attempts,
  backoff,
}: CronRun) => {
  const handler = handlerName as keyof JobPayloads;
  return enqueueJob(handler, (payload ?? undefined) as JobPayloads[typeof handler], {
    id: cronJobId,
    type: JobType.cronTrigger,
    lane,
    attempts,
    backoff,
  });
};

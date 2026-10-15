/**
 * @atlas
 * @kind service
 * @partOf primitive:jobs, feature:cronJob
 * @uses infrastructure:redis
 */
import type { Job } from 'bullmq';
import { enqueueJob } from '#/jobs/enqueue';
import type { JobPayloads } from '#/jobs/handlers';
import { type JobData, JobType } from '#/jobs/types';

// A cron tick's whole action. The tick (a BullMQ repeatable) does not run the handler itself: it
// enqueues the real run through enqueueJob as a `cronTrigger` job carrying the cron row's id, exactly as
// a manual trigger from the admin API does (triggerCronJob). So a scheduled run and a manual trigger
// collide like any two enqueues of that handler: a singleton skips while a run for the row exists
// (deduplicated on the row), a superseding job takes over. A repeatable's job template cannot carry a
// deduplication id, which is why the tick hands off instead of running.
export const enqueueCronRun = async (tick: Job<JobData>): Promise<void> => {
  const { id, lane, payload } = tick.data;
  const handlerName = tick.name as keyof JobPayloads;
  await enqueueJob(handlerName, (payload ?? undefined) as JobPayloads[typeof handlerName], {
    type: JobType.cronTrigger,
    id,
    lane,
  });
};

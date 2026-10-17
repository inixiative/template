/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { runJobStages } from '#/jobs/runJobStages';
import type { JobHandler, JobLane, StagedJob } from '#/jobs/types';

type MakeJobOptions = { lane?: JobLane };

// A plain handler, or `{ stages, finish }` for a job that fans out and waits (see runJobStages).
export const makeJob = <TPayload = void>(
  definition: JobHandler<TPayload> | StagedJob<TPayload>,
  { lane }: MakeJobOptions = {},
): JobHandler<TPayload> => {
  const handler = typeof definition === 'function' ? definition : runJobStages(definition);
  handler.lane = lane;
  return handler;
};

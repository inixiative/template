/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { toJobHandler } from '#/jobs/toJobHandler';
import type { JobHandler, JobLane, StagedJob } from '#/jobs/types';

type MakeJobOptions = { lane?: JobLane };

// A plain handler, or `{ stages, finish }` for a job that fans out and waits (see runJobStages). Every
// job constructor takes either (toJobHandler).
export const makeJob = <TPayload = void>(
  definition: JobHandler<TPayload> | StagedJob<TPayload>,
  { lane }: MakeJobOptions = {},
): JobHandler<TPayload> => {
  const handler = toJobHandler(definition);
  handler.lane = lane;
  return handler;
};

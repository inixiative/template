/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses none
 * @constructs jobHandler
 */
import type { JobHandler, JobLane } from '#/jobs/types';

type MakeJobOptions = { lane?: JobLane };

export const makeJob = <TPayload = void>(
  handler: JobHandler<TPayload>,
  { lane }: MakeJobOptions = {},
): JobHandler<TPayload> => {
  handler.lane = lane;
  return handler;
};

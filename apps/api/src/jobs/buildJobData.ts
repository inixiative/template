/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses none
 */
import { type JobData, type JobHandler, JobLane } from '#/jobs/types';

type JobDataRequest<TPayload> = Omit<JobData<TPayload>, 'lane'> & { lane?: JobLane };

export const buildJobData = <TPayload>(
  handler: Pick<JobHandler<never>, 'lane'>,
  request: JobDataRequest<TPayload>,
  enqueueLane?: JobLane,
): JobData<TPayload> => ({
  id: request.id,
  type: request.type,
  lane: request.lane ?? enqueueLane ?? handler.lane ?? JobLane.fast,
  payload: request.payload,
  dedupeKey: request.dedupeKey,
  traceContext: request.traceContext,
});

export const isSlowJobData = (data: { lane?: string } | undefined): boolean => data?.lane === JobLane.slow;

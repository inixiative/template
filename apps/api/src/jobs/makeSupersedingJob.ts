/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import {
  claimLaneUnlessNewerHolder,
  fetchSupersededBy,
  holdLaneWhileParked,
  laneKey,
  markDisplacedHolder,
  watchLane,
} from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { Job, WaitingChildrenError } from 'bullmq';
import { jobLaneStore } from '#/jobs/jobLaneStore';
import { toJobHandler } from '#/jobs/toJobHandler';
import {
  type JobData,
  type JobHandler,
  type JobHandlerArgs,
  type JobsQueue,
  type StagedJob,
  SupersededError,
} from '#/jobs/types';

export type SupersedingJobHandler<TPayload = void> = JobHandler<TPayload> & {
  dedupeKeyFn?: (payload: TPayload) => string;
};

const parentLaneOf = async (queue: JobsQueue, parentId: string): Promise<string | undefined> => {
  const parent = await Job.fromId(queue, parentId);
  const dedupeKey = (parent?.data as JobData | undefined)?.dedupeKey;
  return parent && dedupeKey ? laneKey(parent.name, dedupeKey) : undefined;
};

const isSupersededBeforeStart = async (
  jobId: string,
  parentId: string | undefined,
  lane: string,
): Promise<boolean> => {
  if (await fetchSupersededBy(jobLaneStore, jobId)) return true;
  if (parentId && (await fetchSupersededBy(jobLaneStore, parentId))) return true;
  const claim = await claimLaneUnlessNewerHolder(jobLaneStore, lane, jobId);
  if (!claim.claimed) return true;
  await markDisplacedHolder(jobLaneStore, lane, jobId, claim.previous);
  return false;
};

// Takes a plain handler or `{ stages, finish }`. A staged superseding job may only add superseding
// children (validateChildJobHandler). The superseded fact lives on the job's own record (its BullMQ job
// hash, field `supersededBy`) and goes with it. A job reads its own and its parent's at start, and on every
// lane poll while it runs; a child that finds its parent superseded marks itself, so its own children stop.
// While a child runs, its poll keeps a parked parent's lane alive.
export const makeSupersedingJob = <TPayload = void>(
  definition: JobHandler<TPayload> | StagedJob<TPayload>,
  dedupeKeyFn: (payload: TPayload) => string,
): SupersedingJobHandler<TPayload> => {
  const handler = toJobHandler(definition, { childrenMustSupersede: true });
  const h: SupersedingJobHandler<TPayload> = async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    const { job } = ctx;
    const lane = laneKey(job.name, dedupeKeyFn(args[0] as TPayload));
    const abortController = new AbortController();

    const abortPromise = new Promise<never>((_, reject) => {
      abortController.signal.addEventListener('abort', () => reject(new SupersededError(job.id)));
    });

    const parentId = job.parent?.id;
    try {
      if (job.id && (await isSupersededBeforeStart(job.id, parentId, lane))) {
        log.info(`Job ${job.id} already superseded before start`, LogScope.job);
        return;
      }
    } catch (err) {
      log.error(
        `Supersession check failed at job start (${job.id}) — continuing`,
        err,
        LogScope.job,
      );
    }

    const parentLane = parentId ? await parentLaneOf(ctx.queue, parentId) : undefined;
    const stopWatch = watchLane(
      jobLaneStore,
      {
        lane,
        holderId: job.id!,
        parent: parentId ? { holderId: parentId, lane: parentLane } : undefined,
      },
      () => abortController.abort(new SupersededError(job.id)),
    );

    try {
      return await Promise.race([
        handler({ ...ctx, signal: abortController.signal }, ...args),
        abortPromise,
      ]);
    } catch (err) {
      if (err instanceof SupersededError || (err instanceof Error && err.name === 'AbortError'))
        return;
      if (err instanceof WaitingChildrenError) {
        await holdLaneWhileParked(jobLaneStore, lane, job.id ?? '').catch((holdErr) =>
          log.error(`Failed to hold the lane of parked job ${job.id}`, holdErr, LogScope.job),
        );
      }
      throw err;
    } finally {
      stopWatch();
    }
  };
  h.dedupeKeyFn = dedupeKeyFn;
  h.lane = handler.lane;
  return h;
};

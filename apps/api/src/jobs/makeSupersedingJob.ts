/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import {
  getJobSupersededBy,
  holdLaneWhileParked,
  laneKey,
  reclaimLane,
  tombstoneJob,
  watchLane,
} from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { WaitingChildrenError } from 'bullmq';
import { toJobHandler } from '#/jobs/toJobHandler';
import {
  type JobHandler,
  type JobHandlerArgs,
  type StagedJob,
  SupersededError,
} from '#/jobs/types';

export type SupersedingJobHandler<TPayload = void> = JobHandler<TPayload> & {
  dedupeKeyFn?: (payload: TPayload) => string;
};

// Takes a plain handler or `{ stages, finish }`. A staged superseding job may only add superseding
// children (validateChildJobHandler). A child listens to its parent as well as to itself: at start, and
// on every lane poll (watchLane), a tombstone on its parent stops it exactly as its own would, and it
// tombstones itself with the same superseder so its own children stop in turn, at any depth. Only
// superseding jobs are ever tombstoned, so a child of a singleton or plain parent never sees one.
// Nothing evicts children: when a newer copy replaces the parent, the claimLane tombstone is all the
// children need. Once they have ended, the old parent wakes, finds its tombstone at start, and exits
// without `finish`.
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

    // The enqueue-time baton can expire while this job sits queued (its TTL covers delay + a wait
    // buffer, but congestion is unbounded). The per-job tombstone is the durable edge: a job displaced
    // while queued exits here even though its lane key already expired. Then re-assert the baton — over
    // a vacant lane or an OLDER holder (which gets tombstoned and usurped via its own watch), never a
    // newer one, so a newer claimant still usurps us via the first poll below.
    const parentId = job.parent?.id;
    try {
      const supersededBy =
        job.id &&
        ((await getJobSupersededBy(job.id)) ??
          (parentId ? await getJobSupersededBy(parentId) : null));
      if (job.id && supersededBy) {
        await tombstoneJob(job.id, supersededBy);
        log.info(`Job ${job.id} already superseded before start`, LogScope.job);
        return;
      }
      await reclaimLane(lane, job.id!);
    } catch (err) {
      log.error(
        `Supersession check failed at job start (${job.id}) — continuing`,
        err,
        LogScope.job,
      );
    }

    const stopWatch = watchLane(
      lane,
      job.id!,
      () => abortController.abort(new SupersededError(job.id)),
      parentId,
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
        await holdLaneWhileParked(lane, job.id ?? '').catch((holdErr) =>
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

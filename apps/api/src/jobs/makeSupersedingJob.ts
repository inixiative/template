/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { getJobSupersededBy, laneKey, reclaimLane, watchLane } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { type JobHandler, type JobHandlerArgs, SupersededError } from '#/jobs/types';

export type SupersedingJobHandler<TPayload = void> = JobHandler<TPayload> & {
  dedupeKeyFn?: (payload: TPayload) => string;
};

export const makeSupersedingJob = <TPayload = void>(
  handler: JobHandler<TPayload>,
  dedupeKeyFn: (payload: TPayload) => string,
): SupersedingJobHandler<TPayload> => {
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
    try {
      if (job.id && (await getJobSupersededBy(job.id))) {
        log.info(`Job ${job.id} already superseded before start`, LogScope.job);
        return;
      }
      await reclaimLane(lane, job.id!);
    } catch (err) {
      log.error(`Supersession check failed at job start (${job.id}) — continuing`, err, LogScope.job);
    }

    const stopWatch = watchLane(lane, job.id!, () => abortController.abort(new SupersededError(job.id)));

    try {
      return await Promise.race([handler({ ...ctx, signal: abortController.signal }, ...args), abortPromise]);
    } catch (err) {
      if (err instanceof SupersededError || (err instanceof Error && err.name === 'AbortError')) return;
      throw err;
    } finally {
      stopWatch();
    }
  };
  h.dedupeKeyFn = dedupeKeyFn;
  return h;
};

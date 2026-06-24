/**
 * @atlas
 * @kind constructor
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 * @constructs jobHandler
 */
import { holdsLane, laneKey } from '#/jobs/lanes';
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

    // Poll our lane — once a newer job claims it we're no longer the holder, so abort.
    const checkInterval = setInterval(async () => {
      if (!(await holdsLane(lane, job.id ?? ''))) {
        abortController.abort(new SupersededError(job.id));
        clearInterval(checkInterval);
      }
    }, 500);

    try {
      return await Promise.race([handler({ ...ctx, signal: abortController.signal }, ...args), abortPromise]);
    } catch (err) {
      if (err instanceof SupersededError || (err instanceof Error && err.name === 'AbortError')) return;
      throw err;
    } finally {
      clearInterval(checkInterval);
    }
  };
  h.dedupeKeyFn = dedupeKeyFn;
  return h;
};

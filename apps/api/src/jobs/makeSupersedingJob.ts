import { redisNamespace } from '@template/db';
import { type JobHandler, type JobHandlerArgs, SupersededError } from '#/jobs/types';

export type SupersedingJobHandler<TPayload = void> = JobHandler<TPayload> & {
  dedupeKeyFn?: (payload: TPayload) => string;
};

export const makeSupersedingJob = <TPayload = void>(
  handler: JobHandler<TPayload>,
  dedupeKeyFn: (payload: TPayload) => string,
): SupersedingJobHandler<TPayload> => {
  const h: SupersedingJobHandler<TPayload> = async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    const { queue, job } = ctx;
    const redis = queue.redis;
    const supersededKey = `${redisNamespace.job}:superseded:${job.id}`;
    const abortController = new AbortController();

    const abortPromise = new Promise<never>((_, reject) => {
      abortController.signal.addEventListener('abort', () => reject(new SupersededError(job.id)));
    });

    const checkInterval = setInterval(async () => {
      if (await redis.get(supersededKey)) {
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
      await redis.del(supersededKey).catch(() => {});
    }
  };
  h.dedupeKeyFn = dedupeKeyFn;
  return h;
};

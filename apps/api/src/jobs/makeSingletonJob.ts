/**
 * @atlas
 * @kind constructor
 * @constructs jobHandler
 * @partOf primitive:jobs
 * @uses infrastructure:redis
 */
import { redisNamespace } from '@template/db';
import type { JobHandler, JobHandlerArgs } from '#/jobs/types';

export const makeSingletonJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => {
  return async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    const { queue, job } = ctx;
    const redis = queue.redis;

    // Lock key prefers `data.id` (cron path: row's uuidv7) so a single handler
    // can serve multiple singleton lanes (e.g. one cron job per row). Falls
    // back to `job.name` so ad-hoc/test invocations work without faking an id.
    const lockId = (job.data as { id?: string } | undefined)?.id ?? job.name;
    if (!lockId) throw new Error('Singleton job missing id and name');

    const lockKey = `${redisNamespace.job}:lock:${lockId}`;
    const lockTTL = 300;

    const acquired = await redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
    if (!acquired) return;

    // Heartbeat at 1/5 the TTL so a single missed refresh doesn't release the lock.
    // At TTL=300s, refresh every 60s → tolerates up to 4 missed heartbeats before expiry.
    const heartbeat = setInterval(() => redis.expire(lockKey, lockTTL).catch(() => {}), 60000);

    try {
      await handler(ctx, ...args);
    } finally {
      clearInterval(heartbeat);
      await redis.del(lockKey);
    }
  };
};

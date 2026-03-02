import { redisNamespace } from '@template/db';
import type { JobHandler, JobHandlerArgs } from '#/jobs/types';

export const makeSingletonJob = <TPayload = void>(handler: JobHandler<TPayload>): JobHandler<TPayload> => {
  return async (ctx, ...args: JobHandlerArgs<TPayload>) => {
    const { queue, job } = ctx;
    const redis = queue.redis;
    const jobData = job.data;

    if (!jobData.id) throw new Error('Singleton job missing id');

    const lockKey = `${redisNamespace.job}:lock:${jobData.id}`;
    const lockTTL = 300;

    const acquired = await redis.set(lockKey, '1', 'EX', lockTTL, 'NX');
    if (!acquired) return;

    const heartbeat = setInterval(() => redis.expire(lockKey, lockTTL).catch(() => {}), 120000);

    try {
      await handler(ctx, ...args);
    } finally {
      clearInterval(heartbeat);
      await redis.del(lockKey);
    }
  };
};

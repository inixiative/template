import { spyOn } from 'bun:test';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { queue } from '#/jobs/queue';

// Tests get an in-memory Redis mock, which cannot run BullMQ's Lua scripts; a random queue name keeps parallel runs apart.
export const connectRealJobsQueue = async () => {
  const url = process.env.REDIS_BULLMQ_URL;
  if (!url)
    throw new Error('REDIS_BULLMQ_URL must point at a real Redis for the job scheduler tests');

  const redis = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 2_000 });
  const realQueue = new Queue(`test-jobs-${crypto.randomUUID()}`, { connection: redis });
  await realQueue.waitUntilReady();

  const upsertJobScheduler = spyOn(queue, 'upsertJobScheduler').mockImplementation(((
    ...args: Parameters<Queue['upsertJobScheduler']>
  ) => realQueue.upsertJobScheduler(...args)) as never);
  const removeJobScheduler = spyOn(queue, 'removeJobScheduler').mockImplementation(((
    ...args: Parameters<Queue['removeJobScheduler']>
  ) => realQueue.removeJobScheduler(...args)) as never);
  const getJobSchedulers = spyOn(queue, 'getJobSchedulers').mockImplementation(((
    ...args: Parameters<Queue['getJobSchedulers']>
  ) => realQueue.getJobSchedulers(...args)) as never);

  const schedulerOf = async (jobId: string) => {
    const scheduler = await realQueue.getJobScheduler(jobId);
    return scheduler ? { name: scheduler.name, pattern: scheduler.pattern } : null;
  };

  const close = async (): Promise<void> => {
    upsertJobScheduler.mockRestore();
    removeJobScheduler.mockRestore();
    getJobSchedulers.mockRestore();
    await realQueue.obliterate({ force: true });
    await realQueue.close();
    redis.disconnect();
  };

  return { realQueue, upsertJobScheduler, removeJobScheduler, schedulerOf, close };
};

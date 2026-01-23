import { Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import { db } from '@template/db';
import { env } from '@src/config/env';
import { queue } from './queue';
import { jobHandlers } from './handlers';
import type { WorkerContext } from './types';

// Create separate Redis connection for worker
const workerRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const jobsWorker = new Worker(
  'jobs',
  async (job: Job) => {
    const handler = jobHandlers[job.name];

    if (!handler) {
      console.error(`Unknown job handler: ${job.name}`);
      throw new Error(`Unknown job handler: ${job.name}`);
    }

    const ctx: WorkerContext = {
      db,
      queue,
      job,
    };

    console.log(`Processing job ${job.name} (${job.id})`);

    try {
      await handler(ctx, job.data.payload || {});
      console.log(`Completed job ${job.name} (${job.id})`);
    } catch (error) {
      console.error(`Failed job ${job.name} (${job.id}):`, error);
      throw error;
    }
  },
  {
    connection: workerRedis,
    concurrency: 10,
    lockDuration: 5 * 60 * 1000, // 5 minutes
  },
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  await jobsWorker.close();
  process.exit(0);
});

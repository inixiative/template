import { db } from '@template/db';
import { log, logScope } from '@template/shared/logger';
import { type Job, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { registerHooks } from '#/hooks';
import { isValidHandlerName, jobHandlers } from '#/jobs/handlers';
import { queue } from '#/jobs/queue';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import type { WorkerContext } from '#/jobs/types';
import { createRedisConnection } from '#/lib/clients/redis';
import { onShutdown } from '#/lib/shutdown';

// Register database hooks (cache clear, webhooks)
registerHooks();

let jobsWorker: Worker | null = null;
let workerRedis: Redis | null = null;

export const initializeWorker = async (): Promise<void> => {
  if (process.env.ENVIRONMENT === 'test') {
    log.info('Skipping worker initialization in test environment');
    return;
  }

  // BullMQ Worker needs its own connection (separate from Queue)
  workerRedis = createRedisConnection('Redis:BullMQ:Worker');

  jobsWorker = new Worker(
    'jobs',
    async (job: Job) => {
      if (!isValidHandlerName(job.name)) {
        log.error(`Unknown job handler: ${job.name}`);
        throw new Error(`Unknown job handler: ${job.name}`);
      }

      const handler = jobHandlers[job.name];

      const scopeId = `${job.name}:${job.id}`;
      await logScope('worker', () => logScope(scopeId, () =>
        db.scope(scopeId, async () => {
          const ctx: WorkerContext = {
            db,
            queue,
            job,
          };

          log.info(`Processing job ${job.name} (${job.id})`);

          try {
            await handler(ctx, job.data.payload || {});
            log.info(`Completed job ${job.name} (${job.id})`);
          } catch (error) {
            log.error(`Failed job ${job.name} (${job.id}):`, error);
            throw error;
          }
        }),
      ));
    },
    {
      connection: workerRedis,
      concurrency: 10,
      lockDuration: 5 * 60 * 1000,
    },
  );

  log.info('Job worker initialized');

  await registerCronJobs();

  onShutdown(async () => {
    log.info('Stopping job worker...');
    if (jobsWorker) await jobsWorker.close();
    if (workerRedis) await workerRedis.quit();
    log.info('Job worker stopped');
  });
};

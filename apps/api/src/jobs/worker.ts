/**
 * @atlas
 * @kind entrypoint
 * @partOf primitive:jobs
 * @uses infrastructure:redis, infrastructure:prisma
 */
import '#/config/env';
import { createRedisConnection, db } from '@template/db';
import { LogScope, log } from '@template/shared/logger';
import { metrics } from '@template/shared/telemetry';
import { type Job, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { initializeOpenTelemetry, shutdownOpenTelemetry } from '#/config/otel';
import { registerHooks } from '#/hooks';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';
import { enqueueJob } from '#/jobs/enqueue';
import { flushOutbox } from '#/jobs/outbox';
import { startOutboxDrainLoop, stopOutboxDrainLoop } from '#/jobs/outbox/drain';
import { processJob } from '#/jobs/processJob';
import { queue } from '#/jobs/queue';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import { jobsWorkerConcurrency } from '#/jobs/slowLane/config';
import { startWorkerPresence, stopWorkerPresence } from '#/jobs/slowLane/presence';
import { initGracefulShutdown, onShutdown } from '#/lib/shutdown';

// Register database hooks (cache clear, webhooks)
registerHooks();

let jobsWorker: Worker | null = null;
let workerRedis: Redis | null = null;

export const initializeWorker = async (): Promise<void> => {
  if (process.env.ENVIRONMENT === 'test') {
    log.info('Skipping worker initialization in test environment', LogScope.worker);
    return;
  }

  // BullMQ Worker needs its own connection (separate from Queue)
  workerRedis = createRedisConnection('Redis:BullMQ:Worker', resolveBullmqRedisUrl());

  await startWorkerPresence();
  try {
    jobsWorker = new Worker('jobs', (job: Job) => processJob(job), {
      connection: workerRedis,
      concurrency: jobsWorkerConcurrency(),
      lockDuration: 5 * 60 * 1000,
    });
  } catch (err) {
    await stopWorkerPresence();
    throw err;
  }

  metrics
    .getMeter('template.worker')
    .createObservableGauge('messaging.queue.messages')
    .addCallback(async (result) => {
      const counts = await queue.getJobCounts('wait', 'active', 'delayed', 'failed');
      for (const [state, count] of Object.entries(counts))
        result.observe(count, { 'messaging.destination.name': 'jobs', state });
    });

  log.info('Job worker initialized', LogScope.worker);

  await registerCronJobs();

  // Per-worker in-process drain, not a queued cron — see outbox/drain/loop.ts.
  startOutboxDrainLoop();

  await enqueueJob('rotateEncryptionKeys', undefined, { id: 'rotateEncryptionKeys' });

  onShutdown(async () => {
    log.info('Stopping job worker...', LogScope.worker);
    stopOutboxDrainLoop(); // stop arming new drain ticks before tearing down the worker/queue
    if (jobsWorker) await jobsWorker.close(); // stop processing first — no new spills from finishing jobs
    await stopWorkerPresence(); // only after close: active slow jobs keep this worker counted in the fleet cap
    await flushOutbox(); // then persist any buffered overflow spills
    if (workerRedis) await workerRedis.quit();
    log.info('Job worker stopped', LogScope.worker);
  });
};

if (import.meta.main) {
  await initializeOpenTelemetry('worker');
  initGracefulShutdown();
  await initializeWorker();
  onShutdown(async () => {
    await queue.close();
    await db.$disconnect();
  });
  onShutdown(shutdownOpenTelemetry);
}

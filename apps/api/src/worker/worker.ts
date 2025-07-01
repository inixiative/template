import { base } from 'src/base';
import { Worker } from 'bullmq';
import type { JobData } from 'src/plugins/queue';
import { processJob } from 'src/worker/processJob';

export const worker = base
  .guard({
    beforeHandle({ redis, queues, error }) {
      if (!redis?.queue) return error(500, 'Redis queue connection not available');
      if (!queues?.default) return error(500, 'Queue not initialized');
    }
  })
  .onStart(({ redis, tracer, metrics, store }) => {
    const telemetryContext = { tracer, metrics, store };
    
    const bullWorker = new Worker<JobData>('default', processJob(telemetryContext), {
      connection: redis.queue,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000
      }
    });

    bullWorker.on('completed', (job) => {
      console.log(`Job ${job.id} completed`);
    });

    bullWorker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    bullWorker.on('error', (err) => {
      console.error('Worker error:', err);
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, closing worker...');
      await bullWorker.close();
      process.exit(0);
    });

    console.log('Worker started with Elysia context');
  });
import { Elysia } from 'elysia';
import { Queue, QueueEvents } from 'bullmq';
import type { Redis } from 'ioredis';

export interface JobData {
  type: string;
  payload: any;
}

export const queue = new Elysia({ name: 'queue' })
  .guard({
    beforeHandle({ redis, error }) {
      if (!redis?.queue) return error(500, 'Redis queue connection not available');
    }
  })
  .decorate('queues', {
    default: null as Queue<JobData> | null,
    events: null as QueueEvents | null
  })
  .onStart(({ queues, redis }) => {
    queues.default = new Queue<JobData>('default', {
      connection: redis.queue as Redis,
      defaultJobOptions: {
        removeOnComplete: {
          count: 100,
          age: 24 * 3600
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600
        },
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    });

    queues.events = new QueueEvents('default', {
      connection: redis.queue as Redis
    });

    console.log('Queue plugin initialized');
    
    // Set up queue metrics monitoring
    if (queues.default && queues.events) {
      queues.events.on('completed', ({ jobId }) => {
        console.log(`Job ${jobId} completed event received`);
      });
      
      queues.events.on('failed', ({ jobId, failedReason }) => {
        console.error(`Job ${jobId} failed: ${failedReason}`);
      });
      
      // Monitor queue size periodically
      setInterval(async () => {
        if (!queues.default) return;
        
        const [waiting, active, completed, failed] = await Promise.all([
          queues.default.getWaitingCount(),
          queues.default.getActiveCount(),
          queues.default.getCompletedCount(),
          queues.default.getFailedCount(),
        ]);
        
        const metrics = this.metrics;
        if (metrics?.queueSize) {
          metrics.queueSize.add(waiting, { state: 'waiting' });
          metrics.queueSize.add(active, { state: 'active' });
          metrics.queueSize.add(-waiting - active, { state: 'total' });
        }
      }, 10000); // Every 10 seconds
    }
  })
  .onStop(async ({ queues }) => {
    if (queues.default) await queues.default.close();
    if (queues.events) await queues.events.close();
    console.log('Queue plugin stopped');
  })
  .decorate('addJob', async function(type: string, payload: any, options?: any) {
    if (!this.queues.default) throw new Error('Queue not initialized');
    return this.queues.default.add(type, { type, payload }, options);
  });
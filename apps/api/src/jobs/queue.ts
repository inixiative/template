import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { env } from '@src/config/env';

// Create Redis connection for queue
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const queue = new Queue('jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // 7 days
      count: 100,
    },
    removeOnFail: {
      age: 30 * 24 * 60 * 60, // 30 days
    },
  },
});

export type JobsQueue = typeof queue;

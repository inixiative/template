import { Queue } from 'bullmq';
import type { JobsQueue } from '#/jobs/types';
import { createRedisConnection } from '@template/db';
import packageJson from "#/../package.json" with { type: "json" };
import { BullMQOtel } from "bullmq-otel";

// BullMQ Queue needs its own connection (separate from Worker)
const redis = createRedisConnection('Redis:BullMQ:Queue');

const baseQueue = new Queue('jobs', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 7 * 24 * 60 * 60, count: 100 },
    removeOnFail: { age: 30 * 24 * 60 * 60 },
  },
  telemetry: new BullMQOtel("bullmq-jobs", packageJson.version),
});

export const queue = Object.assign(baseQueue, { redis }) as JobsQueue;

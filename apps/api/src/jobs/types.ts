import type { ExtendedPrismaClient } from '@template/db';
import type { Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export type JobsQueue = Queue & { redis: Redis };

export type WorkerContext = {
  db: ExtendedPrismaClient;
  queue: JobsQueue;
  job: Job;
  signal?: AbortSignal;
};

export class SupersededError extends Error {
  constructor(jobId: string | undefined) {
    super(`Job ${jobId} was superseded`);
    this.name = 'SupersededError';
  }
}

export const JobType = {
  cron: 'cron',
  adhoc: 'adhoc',
  cronTrigger: 'cronTrigger',
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export type JobData<TPayload = unknown> = {
  id?: string;
  type: JobType;
  payload: TPayload;
  dedupeKey?: string;
};

export type JobHandler<TPayload = unknown> = (ctx: WorkerContext, payload: TPayload) => Promise<void>;

export type JobOptions = {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: number | { type: string; delay: number };
  removeOnComplete?: boolean | number | { age: number; count?: number };
  removeOnFail?: boolean | number | { age: number; count?: number };
  jobId?: string;
};

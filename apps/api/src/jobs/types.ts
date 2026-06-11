/**
 * @atlas
 * @kind type
 * @partOf primitive:jobs
 */
import type { Db } from '@template/db';
import type { Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export type JobsQueue = Queue & { redis: Redis };

// Handlers `import { log } from '@template/shared/logger'` directly. The
// worker registers the BullBoard broadcast via async-local-storage before
// invoking the handler, so log calls automatically also flow to job.log()
// without needing a context wrapper.
export type WorkerContext = {
  db: Db;
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

export type JobHandlerArgs<TPayload = void> = [TPayload] extends [undefined] ? [] : [payload: TPayload];

export type JobHandler<TPayload = void> = (ctx: WorkerContext, ...args: JobHandlerArgs<TPayload>) => Promise<void>;

export type JobOptions = {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: number | { type: string; delay: number };
  removeOnComplete?: boolean | number | { age: number; count?: number };
  removeOnFail?: boolean | number | { age: number; count?: number };
  jobId?: string;
};

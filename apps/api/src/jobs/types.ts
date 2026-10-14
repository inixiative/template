/**
 * @atlas
 * @kind type
 * @partOf primitive:jobs
 * @uses infrastructure:prisma, infrastructure:redis
 */
import type { Db } from '@template/db';
import { JobLane } from '@template/db/generated/client/enums';
import type { Job, Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import type { JobPayloads } from '#/jobs/handlers';

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

export { JobLane };

export type JobData<TPayload = unknown> = {
  id?: string;
  type: JobType;
  lane: JobLane;
  payload: TPayload;
  dedupeKey?: string;
  traceContext?: Record<string, string>;
  // The next stage a staged job runs (see runJobStages); absent until its first stage completes.
  stage?: number;
};

export type JobHandlerArgs<TPayload = void> = [TPayload] extends [undefined]
  ? []
  : [payload: TPayload];

export type JobHandler<TPayload = void> = ((
  ctx: WorkerContext,
  ...args: JobHandlerArgs<TPayload>
) => Promise<void>) & {
  lane?: JobLane;
  // Set on a handler built from `{ stages, finish }` (runJobStages): a superseded copy may be parked
  // with children that enqueue must evict (evictSupersededFlow).
  isStaged?: boolean;
};

// Adds a child of the running job. Exists only on a stage's context: only a job can have children.
export type EnqueueChildJob = <K extends keyof JobPayloads>(
  handlerName: K,
  payload: JobPayloads[K],
) => Promise<void>;

export type StageContext = WorkerContext & { enqueueChildJob: EnqueueChildJob };

export type JobStage<TPayload = void> = (
  ctx: StageContext,
  ...args: JobHandlerArgs<TPayload>
) => Promise<void>;

// A job that fans out and waits: each stage runs once its predecessor's children have all reported,
// and `finish` runs once, after the last stage.
export type StagedJob<TPayload = void> = {
  stages: JobStage<TPayload>[];
  finish: (ctx: WorkerContext, ...args: JobHandlerArgs<TPayload>) => Promise<void>;
};

export type JobOptions = {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: number | { type: string; delay: number };
  removeOnComplete?: boolean | number | { age: number; count?: number };
  removeOnFail?: boolean | number | { age: number; count?: number };
  jobId?: string;
  // Set only by a stage's enqueueChildJob: the BullMQ flow parent, and whether a child that exhausts
  // its retries counts as done rather than leaving its parent waiting.
  parent?: { id: string; queue: string };
  ignoreDependencyOnFailure?: boolean;
};

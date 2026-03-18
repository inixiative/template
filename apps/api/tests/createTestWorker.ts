import '#tests/mocks/queue';
import { mock } from 'bun:test';
import { db } from '@template/db';
import type { Job } from 'bullmq';
import { jobHandlers } from '#/jobs/handlers';
import { queue } from '#/jobs/queue';
import type { WorkerContext } from '#/jobs/types';
import { auditActorContext, nullAuditActor } from '#/lib/auditActorContext';

export const createMockJob = (overrides?: Partial<Job>): Job =>
  ({
    id: 'test-job-id',
    name: 'test-job',
    data: {},
    opts: {},
    timestamp: Date.now(),
    returnvalue: null,
    progress: 0,
    attemptsMade: 0,
    failedReason: undefined,
    stacktrace: [],
    finishedOn: undefined,
    processedOn: undefined,
    log: mock(() => Promise.resolve(1)),
    ...overrides,
  }) as Job;

export const createTestWorker = (
  jobOverrides?: Partial<Job>,
): WorkerContext & { run: (payload?: unknown) => Promise<void> } => {
  const job = createMockJob(jobOverrides);
  const ctx: WorkerContext = { db, queue, job, log: () => {} };

  const run = (payload?: unknown): Promise<void> =>
    db.scope(
      `${job.name}:${job.id}`,
      () =>
        auditActorContext.scope({ ...nullAuditActor, actorJobName: job.name }, () => {
          const handler = jobHandlers[job.name as keyof typeof jobHandlers] as (
            ctx: WorkerContext,
            payload?: unknown,
          ) => Promise<void>;
          return payload === undefined ? handler(ctx) : handler(ctx, payload);
        }),
      'worker',
    );

  return { ...ctx, run };
};

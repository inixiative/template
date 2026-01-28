import '#tests/mocks/queue';
import { mock } from 'bun:test';
import { db } from '@template/db';
import type { Job } from 'bullmq';
import { queue } from '#/jobs/queue';
import type { WorkerContext } from '#/jobs/types';

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

export const createTestWorker = (jobOverrides?: Partial<Job>): WorkerContext => ({
  db,
  queue,
  job: createMockJob(jobOverrides),
});

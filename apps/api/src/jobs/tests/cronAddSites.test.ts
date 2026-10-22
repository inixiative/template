import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import { JobLane, JobType } from '#/jobs/types';
import { connectRealJobsQueue } from '#tests/utils/realJobsQueue';

describe('cron schedulers stamp the resolved lane and the row retry settings', () => {
  let jobs: Awaited<ReturnType<typeof connectRealJobsQueue>>;

  const templateOf = async (jobId: string) =>
    (await jobs.realQueue.getJobScheduler(jobId))?.template;

  beforeAll(async () => {
    registerCronJobSyncHook();
    jobs = await connectRealJobsQueue();
  });

  afterEach(async () => {
    await jobs.realQueue.obliterate({ force: true });
    await cleanupTouchedTables(db);
  });

  afterAll(async () => {
    clearHookRegistry();
    await jobs.close();
  });

  it('the cronJobSync hook builds the same envelope as enqueue, lane included', async () => {
    const { entity } = await createCronJob({
      handler: 'sweepSegments',
      maxAttempts: 2,
      backoffMs: 1234,
    });

    const template = await templateOf(entity.jobId);
    expect(template?.data).toMatchObject({ id: entity.id, type: JobType.cron, lane: JobLane.fast });
    expect(template?.opts).toMatchObject({
      attempts: 2,
      backoff: { type: 'exponential', delay: 1234 },
    });
  });

  it('registerCronJobs builds the same envelope', async () => {
    const { entity } = await createCronJob({ handler: 'sweepSegments' });
    await jobs.realQueue.removeJobScheduler(entity.jobId);

    await registerCronJobs();

    expect((await templateOf(entity.jobId))?.data).toMatchObject({
      type: JobType.cron,
      lane: JobLane.fast,
    });
  });
});

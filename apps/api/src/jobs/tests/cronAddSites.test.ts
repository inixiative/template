import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import { JobLane, JobType } from '#/jobs/types';
import { useRealJobsQueue } from '#tests/utils/realJobsQueue';

describe('cron schedulers stamp the resolved lane and the row retry settings', () => {
  const jobs = useRealJobsQueue();

  const templateOf = async (jobId: string) =>
    (await jobs().realQueue.getJobScheduler(jobId))?.template;

  afterEach(async () => {
    await cleanupTouchedTables(db);
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
    await jobs().realQueue.removeJobScheduler(entity.jobId);

    await registerCronJobs();

    expect((await templateOf(entity.jobId))?.data).toMatchObject({
      type: JobType.cron,
      lane: JobLane.fast,
    });
  });
});

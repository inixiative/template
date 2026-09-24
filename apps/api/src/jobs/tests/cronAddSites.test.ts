import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createCronJob, getNextSeq } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { queue } from '#/jobs/queue';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import { type JobData, JobLane, type JobsQueue, JobType } from '#/jobs/types';

describe('cron add sites stamp the resolved lane', () => {
  const added: Array<{ name: string; data: JobData }> = [];
  let restore = (): void => {};

  beforeAll(() => {
    registerCronJobSyncHook();
    const add = spyOn(queue, 'add').mockImplementation((async (name: string, data: JobData) => {
      added.push({ name, data });
      return { id: name };
    }) as never);
    const removeRepeatable = spyOn(queue, 'removeRepeatable').mockImplementation((async () => true) as never);
    restore = () => {
      add.mockRestore();
      removeRepeatable.mockRestore();
    };
  });

  afterEach(async () => {
    added.length = 0;
    await db.cronJob.deleteMany({});
  });

  afterAll(async () => {
    restore();
    clearHookRegistry();
    await cleanupTouchedTables(db);
  });

  it('registerCronJobs builds the same envelope as enqueue, lane included', async () => {
    await createCronJob({ name: `register-${getNextSeq()}`, handler: 'sweepSegments', enabled: true });
    added.length = 0;
    const recorded: Array<{ name: string; data: JobData }> = [];
    const recordingQueue = {
      add: async (name: string, data: JobData) => {
        recorded.push({ name, data });
      },
    } as unknown as JobsQueue;

    await registerCronJobs(recordingQueue);

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.data).toMatchObject({ type: JobType.cron, lane: JobLane.fast });
  });

  it('the cronJobSync hook stamps the lane when a row is created', async () => {
    await createCronJob({ name: `sync-${getNextSeq()}`, handler: 'sweepSegments', enabled: true });

    expect(added).toHaveLength(1);
    expect(added[0]?.data).toMatchObject({ type: JobType.cron, lane: JobLane.fast });
  });
});

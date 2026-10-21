import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { registerCronJobs } from '#/jobs/registerCronJobs';
import { withCronJobsLock } from '#/jobs/withCronJobsLock';
import { connectRealJobsQueue } from '#tests/utils/realJobsQueue';

const handler = 'sweepSegments';
const patterns = ['17 3 * * *', '19 5 * * *'] as const;

let jobs: Awaited<ReturnType<typeof connectRealJobsQueue>>;

const newJobId = () => `scheduler-test-${crypto.randomUUID()}`;
const createScheduledCronJob = async (pattern: string = patterns[0]) =>
  (await createCronJob({ jobId: newJobId(), handler, pattern })).entity;

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

describe('registerCronJobs reconciles the schedulers with the enabled rows', () => {
  it('keeps live rows, turns off unschedulable rows and removes orphans and legacy repeatables', async () => {
    const live = await createScheduledCronJob(patterns[1]);
    const legacy = await jobs.realQueue.add(
      handler,
      {},
      { repeat: { pattern: patterns[0], jobId: live.jobId } },
    );
    const orphanKey = newJobId();
    await jobs.realQueue.upsertJobScheduler(orphanKey, { pattern: patterns[0] }, { name: handler });
    const unknownHandler = await createScheduledCronJob();
    await db.raw.cronJob.update({
      where: { id: unknownHandler.id },
      data: { handler: 'renamedHandler' },
    });
    const badPattern = await createScheduledCronJob();
    await db.raw.cronJob.update({ where: { id: badPattern.id }, data: { pattern: '61 * * * *' } });

    await registerCronJobs();

    const ours = new Set([
      live.jobId,
      legacy.repeatJobKey,
      orphanKey,
      unknownHandler.jobId,
      badPattern.jobId,
    ]);
    const remaining = (await jobs.realQueue.getJobSchedulers()).filter((scheduler) =>
      ours.has(scheduler.key),
    );
    expect(remaining.map((scheduler) => scheduler.key)).toEqual([live.jobId]);
    const delayedKeys = (await jobs.realQueue.getDelayed())
      .map((job) => job.repeatJobKey)
      .filter((key) => ours.has(key));
    expect(delayedKeys).toEqual([live.jobId]);

    const turnedOff = await db.cronJob.findMany({
      where: { id: { in: [unknownHandler.id, badPattern.id] } },
      select: { enabled: true },
    });
    expect(turnedOff).toEqual([{ enabled: false }, { enabled: false }]);
  });

  it('throws before the sweep when an upsert fails, so a working legacy repeatable stays', async () => {
    const cronJob = await createScheduledCronJob();
    await jobs.realQueue.removeJobScheduler(cronJob.jobId);
    const legacy = await jobs.realQueue.add(
      handler,
      {},
      { repeat: { pattern: patterns[0], jobId: cronJob.jobId } },
    );
    jobs.upsertJobScheduler.mockImplementationOnce(() =>
      Promise.reject(new Error('Redis unavailable')),
    );

    await expect(registerCronJobs()).rejects.toThrow('Redis unavailable');

    const keys = (await jobs.realQueue.getJobSchedulers()).map((scheduler) => scheduler.key);
    expect(keys).toContain(legacy.repeatJobKey as string);
  });

  it('does not touch the schedulers while an admin write holds the cron-jobs lock', async () => {
    const cronJob = await createScheduledCronJob();
    await jobs.realQueue.removeJobScheduler(cronJob.jobId);
    let reconcile: Promise<void> | undefined;

    await withCronJobsLock(async () => {
      reconcile = registerCronJobs();
      await Bun.sleep(300);
      expect(await jobs.schedulerOf(cronJob.jobId)).toBeNull();
    });
    await reconcile;

    expect(await jobs.schedulerOf(cronJob.jobId)).toEqual({ name: handler, pattern: patterns[0] });
  });
});

describe('the cronJobSync hook', () => {
  it('moves the scheduler when a row is edited, renamed and deleted', async () => {
    const row = await createScheduledCronJob();
    expect(await jobs.schedulerOf(row.jobId)).toEqual({ name: handler, pattern: patterns[0] });

    await db.cronJob.update({ where: { id: row.id }, data: { pattern: patterns[1] } });
    expect(await jobs.schedulerOf(row.jobId)).toEqual({ name: handler, pattern: patterns[1] });

    const renamed = newJobId();
    await db.cronJob.update({
      where: { id: row.id },
      data: { handler: 'cleanStaleData', jobId: renamed },
    });
    expect(await jobs.schedulerOf(row.jobId)).toBeNull();
    expect(await jobs.schedulerOf(renamed)).toEqual({
      name: 'cleanStaleData',
      pattern: patterns[1],
    });

    await db.cronJob.delete({ where: { id: row.id } });
    expect(await jobs.schedulerOf(renamed)).toBeNull();
  });

  it('re-syncs on an update that changes nothing', async () => {
    const row = await createScheduledCronJob();
    await jobs.realQueue.removeJobScheduler(row.jobId);

    await db.cronJob.update({ where: { id: row.id }, data: { pattern: row.pattern } });

    expect(await jobs.schedulerOf(row.jobId)).toEqual({ name: handler, pattern: patterns[0] });
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { type SeedFile, seedTable } from '@template/db/prisma/seed';
import { seeds } from '@template/db/prisma/seeds';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { isValidJobId } from '#/jobs/validateJobId';
import { connectRealJobsQueue } from '#tests/utils/realJobsQueue';

const cronJobSeeds = seeds.find((file) => file.model === 'cronJob')!;
const systemSeed = cronJobSeeds.records.find((record) => record.handler === 'sweepSegments')!;
const seedFile: SeedFile = { ...cronJobSeeds, records: [systemSeed] };

describe('cron job seeds sync system rows', () => {
  let jobs: Awaited<ReturnType<typeof connectRealJobsQueue>>;

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

  it('gives every seeded row a jobId BullMQ accepts as a scheduler key', () => {
    expect(cronJobSeeds.records.filter((record) => !isValidJobId(record.jobId as string))).toEqual(
      [],
    );
  });

  it('renames a system row on re-seed and moves its scheduler', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'sweepSegmentsLegacy',
      jobId: 'sweepSegmentsLegacy',
      handler: 'cleanStaleData',
      description: 'Legacy description.',
      pattern: '0 4 * * *',
    });
    expect(await jobs.schedulerOf('sweepSegmentsLegacy')).toEqual({
      name: 'cleanStaleData',
      pattern: '0 4 * * *',
    });

    await seedTable(seedFile);

    const row = await db.cronJob.findUniqueOrThrow({ where: { id: systemSeed.id } });
    expect(row).toMatchObject({
      name: 'sweepSegments',
      jobId: 'sweepSegments',
      handler: 'sweepSegments',
      description: systemSeed.description,
    });
    expect(await jobs.schedulerOf('sweepSegmentsLegacy')).toBeNull();
    expect(await jobs.schedulerOf('sweepSegments')).toEqual({
      name: 'sweepSegments',
      pattern: '0 4 * * *',
    });
  });

  it('keeps the fields an admin edited', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'sweepSegmentsLegacy',
      jobId: 'sweepSegmentsLegacy',
      handler: 'cleanStaleData',
      pattern: '*/5 * * * *',
      enabled: false,
      payload: { batch: 10 },
      maxAttempts: 7,
      backoffMs: 1234,
    });

    await seedTable(seedFile);

    const row = await db.cronJob.findUniqueOrThrow({ where: { id: systemSeed.id } });
    expect(row).toMatchObject({
      handler: 'sweepSegments',
      pattern: '*/5 * * * *',
      enabled: false,
      payload: { batch: 10 },
      maxAttempts: 7,
      backoffMs: 1234,
    });
    expect(await jobs.schedulerOf('sweepSegments')).toBeNull();
  });

  it('inserts a missing row and leaves one scheduler on an unchanged re-seed', async () => {
    await seedTable(seedFile);
    await seedTable(seedFile);

    const schedulers = await jobs.realQueue.getJobSchedulers();
    expect(schedulers.map(({ key, pattern }) => ({ key, pattern }))).toEqual([
      { key: 'sweepSegments', pattern: systemSeed.pattern as string },
    ]);
  });
});

import { afterEach, describe, expect, it } from 'bun:test';
import { db } from '@template/db';
import { type SeedFile, seedTable } from '@template/db/prisma/seed';
import { seeds } from '@template/db/prisma/seeds';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { isValidJobId } from '#/jobs/validateJobId';
import { useRealJobsQueue } from '#tests/utils/realJobsQueue';

const cronJobSeeds = seeds.find((file) => file.model === 'cronJob')!;
const systemSeed = cronJobSeeds.records.find(
  (record) => record.handler === 'reconcileEveryHealthyDynamicSegment',
)!;
const seedFile: SeedFile = { ...cronJobSeeds, records: [systemSeed] };

describe('cron job seeds sync system rows', () => {
  const jobs = useRealJobsQueue();

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('gives every seeded row a jobId BullMQ accepts as a scheduler key', () => {
    expect(cronJobSeeds.records.filter((record) => !isValidJobId(record.jobId as string))).toEqual(
      [],
    );
  });

  it('renames a system row on re-seed and moves its scheduler', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'reconcileEveryHealthyDynamicSegmentLegacy',
      jobId: 'reconcileEveryHealthyDynamicSegmentLegacy',
      handler: 'hardDeleteRecordsPastRetention',
      description: 'Legacy description.',
      pattern: '0 4 * * *',
    });
    expect(await jobs().schedulerOf('reconcileEveryHealthyDynamicSegmentLegacy')).toEqual({
      name: 'hardDeleteRecordsPastRetention',
      pattern: '0 4 * * *',
    });

    await seedTable(seedFile);

    const row = await db.cronJob.findUniqueOrThrow({ where: { id: systemSeed.id } });
    expect(row).toMatchObject({
      name: 'reconcileEveryHealthyDynamicSegment',
      jobId: 'reconcileEveryHealthyDynamicSegment',
      handler: 'reconcileEveryHealthyDynamicSegment',
      description: systemSeed.description,
    });
    expect(await jobs().schedulerOf('reconcileEveryHealthyDynamicSegmentLegacy')).toBeNull();
    expect(await jobs().schedulerOf('reconcileEveryHealthyDynamicSegment')).toEqual({
      name: 'reconcileEveryHealthyDynamicSegment',
      pattern: '0 4 * * *',
    });
  });

  it('keeps the fields an admin edited', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'reconcileEveryHealthyDynamicSegmentLegacy',
      jobId: 'reconcileEveryHealthyDynamicSegmentLegacy',
      handler: 'hardDeleteRecordsPastRetention',
      pattern: '*/5 * * * *',
      enabled: false,
      payload: { batch: 10 },
      maxAttempts: 7,
      backoffMs: 1234,
    });

    await seedTable(seedFile);

    const row = await db.cronJob.findUniqueOrThrow({ where: { id: systemSeed.id } });
    expect(row).toMatchObject({
      handler: 'reconcileEveryHealthyDynamicSegment',
      pattern: '*/5 * * * *',
      enabled: false,
      payload: { batch: 10 },
      maxAttempts: 7,
      backoffMs: 1234,
    });
    expect(await jobs().schedulerOf('reconcileEveryHealthyDynamicSegment')).toBeNull();
  });

  it('inserts a missing row and leaves one scheduler on an unchanged re-seed', async () => {
    await seedTable(seedFile);
    await seedTable(seedFile);

    const schedulers = await jobs().realQueue.getJobSchedulers();
    expect(schedulers.map(({ key, pattern }) => ({ key, pattern }))).toEqual([
      { key: 'reconcileEveryHealthyDynamicSegment', pattern: systemSeed.pattern as string },
    ]);
  });
});

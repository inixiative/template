import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { clearHookRegistry, db } from '@template/db';
import { type SeedFile, seedTable } from '@template/db/prisma/seed';
import { seeds } from '@template/db/prisma/seeds';
import { cleanupTouchedTables, createCronJob } from '@template/db/test';
import { registerCronJobSyncHook } from '#/hooks/cronJobSync/hook';
import { queue } from '#/jobs/queue';

const cronJobSeeds = seeds.find((file) => file.model === 'cronJob')!;
const systemSeed = cronJobSeeds.records.find((record) => record.handler === 'sweepSegments')!;
const seedFile: SeedFile = { ...cronJobSeeds, records: [systemSeed] };

describe('cron job seeds sync system rows', () => {
  const added: string[] = [];
  const removed: Array<{ name: string; jobId: unknown }> = [];
  let restore = (): void => {};

  beforeAll(() => {
    registerCronJobSyncHook();
    const add = spyOn(queue, 'add').mockImplementation((async (name: string) => {
      added.push(name);
      return { id: name };
    }) as never);
    const removeRepeatable = spyOn(queue, 'removeRepeatable').mockImplementation((async (
      name: string,
      _repeat: unknown,
      jobId: string,
    ) => {
      removed.push({ name, jobId });
      return true;
    }) as never);
    restore = () => {
      add.mockRestore();
      removeRepeatable.mockRestore();
    };
  });

  afterEach(async () => {
    added.length = 0;
    removed.length = 0;
    await cleanupTouchedTables(db);
  });

  afterAll(() => {
    restore();
    clearHookRegistry();
  });

  it('renames a system row on re-seed and moves its repeatable', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'sweepSegmentsLegacy',
      jobId: 'sweepSegmentsLegacy',
      handler: 'sweepSegmentsLegacy',
      description: 'Legacy description.',
      pattern: '0 4 * * *',
    });
    added.length = 0;

    await seedTable(seedFile);

    const row = await db.cronJob.findUniqueOrThrow({ where: { id: systemSeed.id } });
    expect(row).toMatchObject({
      name: 'sweepSegments',
      jobId: 'sweepSegments',
      handler: 'sweepSegments',
      description: systemSeed.description,
    });
    expect(removed).toEqual([{ name: 'sweepSegmentsLegacy', jobId: 'sweepSegmentsLegacy' }]);
    expect(added).toEqual(['sweepSegments']);
  });

  it('keeps the fields an admin edited', async () => {
    await createCronJob({
      id: systemSeed.id,
      name: 'sweepSegmentsLegacy',
      jobId: 'sweepSegmentsLegacy',
      handler: 'sweepSegmentsLegacy',
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
    expect(added).toEqual([]);
  });

  it('inserts a missing row and leaves BullMQ alone on an unchanged re-seed', async () => {
    await seedTable(seedFile);
    expect(added).toEqual(['sweepSegments']);
    expect(removed).toEqual([]);

    added.length = 0;
    await seedTable(seedFile);

    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { cleanupTouchedTables } from '@template/db/test';
import { drainOutbox } from '#/jobs/handlers/drainOutbox';
import { flushOutbox, isOverflowing, type OutboxRow, spillToOutbox } from '#/jobs/outbox';
import { JobType, type WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

// Exercises the real spill + drain paths. enqueueJob short-circuits to synchronous
// execution under isTest, so the buffer is tested at spillToOutbox/drainOutbox directly.

const OVERFLOW_KEY = 'job:overflow';

const fanRow = (jobId: string): OutboxRow => ({
  handlerName: 'sendWebhook',
  jobId,
  dedupeKey: null,
  data: { type: JobType.adhoc, payload: { jobId } },
  options: {},
});

describe('jobs overflow buffer', () => {
  let ctx: WorkerContext;

  beforeAll(() => {
    ctx = createTestWorker({ name: 'drainOutbox', data: { id: 'drainOutbox' } });
  });

  afterEach(async () => {
    await ctx.db.jobOutbox.deleteMany({});
    await ctx.queue.redis.flushdb();
  });

  afterAll(async () => {
    await cleanupTouchedTables(ctx.db);
    await ctx.queue.redis.flushdb();
  });

  it('coalesces fan-out spills into one createMany', async () => {
    await Promise.all([spillToOutbox(fanRow('a')), spillToOutbox(fanRow('b')), flushOutbox()]);
    expect(await ctx.db.jobOutbox.count()).toBe(2);
  });

  it('dedupes a re-spilled jobId (createMany skipDuplicates)', async () => {
    const p1 = spillToOutbox(fanRow('dup'));
    const p2 = spillToOutbox(fanRow('dup'));
    await flushOutbox();
    await Promise.all([p1, p2]);
    expect(await ctx.db.jobOutbox.count()).toBe(1);
  });

  it('superseding spill keeps only the latest (deleteMany first)', async () => {
    const supRow = (n: number): OutboxRow => ({
      handlerName: 'recordAppEvent',
      jobId: `sup-${n}`,
      dedupeKey: 'lane-1',
      data: { type: JobType.adhoc, payload: { n } },
      options: {},
    });

    await spillToOutbox(supRow(1));
    await spillToOutbox(supRow(2));

    const rows = await ctx.db.jobOutbox.findMany({ where: { dedupeKey: 'lane-1' } });
    expect(rows).toHaveLength(1);
    expect((rows[0].data as { payload: { n: number } }).payload.n).toBe(2);
  });

  it('drain admits buffered jobs to the queue, clears the outbox, and clears the flag', async () => {
    await ctx.queue.redis.set(OVERFLOW_KEY, '1');
    await Promise.all([spillToOutbox(fanRow('d1')), spillToOutbox(fanRow('d2')), flushOutbox()]);
    expect(await ctx.db.jobOutbox.count()).toBe(2);

    await drainOutbox(ctx);

    expect(await ctx.db.jobOutbox.count()).toBe(0);
    const counts = await ctx.queue.getJobCounts('waiting');
    expect(counts.waiting).toBeGreaterThanOrEqual(2);
    expect(await isOverflowing()).toBe(false);
  });

  it('re-enqueues with the stored jobId (idempotent drain)', async () => {
    await Promise.all([spillToOutbox(fanRow('keep-id')), flushOutbox()]);

    await drainOutbox(ctx);

    const job = await ctx.queue.getJob('keep-id');
    expect(job?.id).toBe('keep-id');
  });
});

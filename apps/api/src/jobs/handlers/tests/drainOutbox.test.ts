import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { redisNamespace } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { drainOutbox } from '#/jobs/handlers/drainOutbox';
import { isOverflowing, type OutboxRow, queueDepth, shouldSpill, spillToOutbox, tripIfFull } from '#/jobs/outbox';
import { JobType, type WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

const FLAG_KEY = `${redisNamespace.job}:overflow`;

const fanRow = (jobId: string): OutboxRow => ({
  handlerName: 'sendWebhook',
  jobId,
  dedupeKey: null,
  data: { type: JobType.adhoc, payload: { jobId } },
  options: {},
});

// Pure routing decision — no DB/queue needed.
describe('shouldSpill (routing)', () => {
  it('spills an adhoc, non-bypassed job while overflowing', () => {
    expect(shouldSpill(JobType.adhoc, false, true)).toBe(true);
  });
  it('goes direct when not overflowing', () => {
    expect(shouldSpill(JobType.adhoc, false, false)).toBe(false);
  });
  it('bypass goes direct even while overflowing', () => {
    expect(shouldSpill(JobType.adhoc, true, true)).toBe(false);
  });
  it('cron / cronTrigger go direct even while overflowing', () => {
    expect(shouldSpill(JobType.cron, false, true)).toBe(false);
    expect(shouldSpill(JobType.cronTrigger, false, true)).toBe(false);
  });
});

describe('jobs overflow buffer (spill + drain)', () => {
  let ctx: WorkerContext;

  beforeAll(() => {
    ctx = createTestWorker({ name: 'drainOutbox', data: { id: 'drainOutbox' } });
    process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS = '1'; // size-trip every spill → deterministic commit
  });

  afterEach(async () => {
    delete process.env.JOBS_MAX_QUEUE_DEPTH;
    process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS = '1'; // re-assert the suite default
    await ctx.db.jobOutbox.deleteMany({});
    await ctx.queue.redis.flushdb(); // clears queued jobs + the flag
  });

  afterAll(async () => {
    delete process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS;
    await cleanupTouchedTables(ctx.db);
    await ctx.queue.redis.flushdb();
  });

  it('persists spilled fan-out rows (resolve-on-commit)', async () => {
    await spillToOutbox(fanRow('a'));
    await spillToOutbox(fanRow('b'));
    expect(await ctx.db.jobOutbox.count()).toBe(2);
  });

  it('dedupes the same jobId across flushes (@unique jobId + skipDuplicates)', async () => {
    await spillToOutbox(fanRow('dup'));
    await spillToOutbox(fanRow('dup'));
    expect(await ctx.db.jobOutbox.count()).toBe(1);
  });

  it('superseding spills across flushes collapse to the latest (deleteMany OR)', async () => {
    const supRow = (n: number): OutboxRow => ({
      handlerName: 'recordAppEvent',
      jobId: `sup-${n}`,
      dedupeKey: 'lane-1',
      data: { type: JobType.adhoc, payload: { n }, dedupeKey: 'lane-1' },
      options: {},
    });

    await spillToOutbox(supRow(1)); // size=1 → its own flush
    await spillToOutbox(supRow(2)); // flush deletes lane-1's prior row, inserts this one

    const rows = await ctx.db.jobOutbox.findMany({ where: { dedupeKey: 'lane-1' } });
    expect(rows).toHaveLength(1);
    expect((rows[0].data as { payload: { n: number } }).payload.n).toBe(2);
  });

  it('superseding spills within one batch collapse to the latest', async () => {
    process.env.JOBS_OUTBOX_FLUSH_MAX_ROWS = '3'; // hold all three; flush on the 3rd (size trip)
    const supRow = (n: number): OutboxRow => ({
      handlerName: 'recordAppEvent',
      jobId: `b-${n}`,
      dedupeKey: 'lane-batch',
      data: { type: JobType.adhoc, payload: { n }, dedupeKey: 'lane-batch' },
      options: {},
    });

    await Promise.all([spillToOutbox(supRow(1)), spillToOutbox(supRow(2)), spillToOutbox(supRow(3))]);

    const rows = await ctx.db.jobOutbox.findMany({ where: { dedupeKey: 'lane-batch' } });
    expect(rows).toHaveLength(1);
    expect((rows[0].data as { payload: { n: number } }).payload.n).toBe(3);
  });

  it('tripIfFull sets the flag once depth reaches the cap', async () => {
    process.env.JOBS_MAX_QUEUE_DEPTH = '2';
    await ctx.queue.add('sendWebhook', { type: JobType.adhoc, payload: {} });
    await ctx.queue.add('sendWebhook', { type: JobType.adhoc, payload: {} });

    await queueDepth(true); // prime the cache to the current depth
    await tripIfFull();

    expect(await isOverflowing()).toBe(true);
  });

  it('drain tops up only to the cap, leaving the rest buffered', async () => {
    process.env.JOBS_MAX_QUEUE_DEPTH = '3';
    await ctx.queue.redis.set(FLAG_KEY, '1');
    for (const id of ['r1', 'r2', 'r3', 'r4', 'r5']) await spillToOutbox(fanRow(id));
    expect(await ctx.db.jobOutbox.count()).toBe(5);

    await drainOutbox(ctx);

    // room = cap(3) − depth(0) → 3 admitted, 2 remain buffered
    expect(await ctx.db.jobOutbox.count()).toBe(2);
    expect((await ctx.queue.getJobCounts('waiting')).waiting).toBe(3);
  });

  it('drain admits all and clears the flag below low-water', async () => {
    await ctx.queue.redis.set(FLAG_KEY, '1');
    await spillToOutbox(fanRow('d1'));
    await spillToOutbox(fanRow('d2'));

    await drainOutbox(ctx);

    expect(await ctx.db.jobOutbox.count()).toBe(0);
    expect(await isOverflowing()).toBe(false);
  });

  it('re-enqueues a plain adhoc row with its stored jobId', async () => {
    await spillToOutbox(fanRow('keep-id'));
    await drainOutbox(ctx);
    expect((await ctx.queue.getJob('keep-id'))?.id).toBe('keep-id');
  });
});

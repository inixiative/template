import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { claimLane, laneKey, redisNamespace, watchLane } from '@template/db';
import { setEnvOverride } from '@template/shared/utils';
import { cleanupTouchedTables, createJobOutbox } from '@template/db/test';
import {
  flushOutbox,
  isOverflowing,
  type OutboxRow,
  queueDepth,
  shouldSpill,
  spillToOutbox,
  tripIfFull,
} from '#/jobs/outbox';
import { runDrainOutboxPass } from '#/jobs/outbox/drain';
import { queue } from '#/jobs/queue';
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

  // ioredis-mock can't run BullMQ's Lua scripts, so spy the queue boundary and drive the real
  // outbox logic against an in-memory job map. The overflow flag still uses the (mock) Redis.
  const queued = new Map<string, { id: string; name: string; data: unknown }>();
  const poison = new Set<string>(); // handlerNames whose queue.add throws — drives the quarantine path
  let restoreQueueSpies = (): void => {};

  beforeAll(() => {
    ctx = createTestWorker();

    const add = spyOn(queue, 'add').mockImplementation((async (
      name: string,
      data: unknown,
      opts?: { jobId?: string },
    ) => {
      if (poison.has(name)) throw new Error(`poison handler: ${name}`);
      const id = opts?.jobId ?? `${name}-${queued.size}`;
      if (!queued.has(id)) queued.set(id, { id, name, data });
      return { id };
    }) as never);
    const counts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({
      waiting: queued.size,
      active: 0,
    })) as never);
    const getJob = spyOn(queue, 'getJob').mockImplementation((async (id: string) => queued.get(id)) as never);
    const getJobs = spyOn(queue, 'getJobs').mockImplementation((async () => [...queued.values()]) as never);
    restoreQueueSpies = () => {
      add.mockRestore();
      counts.mockRestore();
      getJob.mockRestore();
      getJobs.mockRestore();
    };
  });

  // Overrides reset after every test via the global backstop; re-assert the suite default per test.
  beforeEach(() => setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1')); // size-trip every spill → deterministic commit

  afterEach(async () => {
    queued.clear();
    poison.clear();
    await ctx.db.jobOutbox.deleteMany({});
    await ctx.queue.redis.flushdb(); // clears the flag
  });

  afterAll(async () => {
    restoreQueueSpies();
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

  it('superseding spills across flushes collapse to the latest (upsert)', async () => {
    const supRow = (n: number): OutboxRow => ({
      handlerName: 'cleanStaleData',
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
    setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '3'); // hold all three; flush on the 3rd (size trip)
    const supRow = (n: number): OutboxRow => ({
      handlerName: 'cleanStaleData',
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
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '2');
    await ctx.queue.add('sendWebhook', { type: JobType.adhoc, payload: {} });
    await ctx.queue.add('sendWebhook', { type: JobType.adhoc, payload: {} });

    await queueDepth(true); // prime the cache to the current depth
    await tripIfFull();

    expect(await isOverflowing()).toBe(true);
  });

  it('drain tops up only to the cap, leaving the rest buffered', async () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '3');
    await ctx.queue.redis.set(FLAG_KEY, String(Date.now()));
    for (const id of ['r1', 'r2', 'r3', 'r4', 'r5']) await spillToOutbox(fanRow(id));
    expect(await ctx.db.jobOutbox.count()).toBe(5);

    await runDrainOutboxPass();

    // room = cap(3) − depth(0) → 3 admitted, 2 remain buffered
    expect(await ctx.db.jobOutbox.count()).toBe(2);
    expect((await ctx.queue.getJobCounts('waiting')).waiting).toBe(3);
  });

  it('drain admits all and clears the flag below low-water', async () => {
    await ctx.queue.redis.set(FLAG_KEY, String(Date.now()));
    await spillToOutbox(fanRow('d1'));
    await spillToOutbox(fanRow('d2'));

    await runDrainOutboxPass();

    expect(await ctx.db.jobOutbox.count()).toBe(0);
    expect(await isOverflowing()).toBe(false);
  });

  it('re-enqueues a plain adhoc row with its stored jobId', async () => {
    await spillToOutbox(fanRow('keep-id'));
    await runDrainOutboxPass();
    expect((await ctx.queue.getJob('keep-id'))?.id).toBe('keep-id');
  });

  it('supersede lanes are handler-scoped — usurping one lane leaves another handler untouched', async () => {
    const laneA = laneKey('handlerA', 'shared');
    const laneB = laneKey('handlerB', 'shared');
    let aUsurped = false;
    let bUsurped = false;
    await claimLane(laneA, 'jobA');
    await claimLane(laneB, 'jobB');
    const stopA = watchLane(laneA, 'jobA', () => {
      aUsurped = true;
    });
    const stopB = watchLane(laneB, 'jobB', () => {
      bUsurped = true;
    });

    await claimLane(laneA, 'jobA2'); // a newer job takes lane A's baton
    await new Promise((r) => setTimeout(r, 700)); // > one poll
    stopA();
    stopB();

    expect(aUsurped).toBe(true);
    expect(bUsurped).toBe(false); // different handler's lane — untouched
  });

  it('bumps a failed re-enqueue and keeps draining the rest (no batch stranding)', async () => {
    poison.add('poisonHandler');
    await ctx.queue.redis.set(FLAG_KEY, String(Date.now()));
    await spillToOutbox({
      handlerName: 'poisonHandler',
      jobId: 'p1',
      dedupeKey: null,
      data: { type: JobType.adhoc, payload: {} },
      options: {},
    });
    await spillToOutbox(fanRow('good'));

    await runDrainOutboxPass();

    // good row admitted + deleted; the poison row stays buffered with attempts bumped, not stranded
    const rows = await ctx.db.jobOutbox.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe('p1');
    expect(rows[0].attempts).toBe(1);
  });

  it('skips a quarantined row (attempts >= cap) so it cannot block newer rows', async () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '3');
    await ctx.queue.redis.set(FLAG_KEY, String(Date.now()));
    await ctx.queue.add('sendWebhook', { type: JobType.adhoc, payload: {} }); // hold depth at low-water so the flag-clear branch doesn't reset
    await createJobOutbox({ jobId: 'quarantined', data: { type: JobType.adhoc, payload: {} }, attempts: 5 });
    await spillToOutbox(fanRow('fresh'));

    await runDrainOutboxPass();

    // fresh row admitted despite the older quarantined row; quarantined row untouched (not bumped, not reset)
    const rows = await ctx.db.jobOutbox.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe('quarantined');
    expect(rows[0].attempts).toBe(5);
  });

  it('resets quarantined rows and clears the flag on full recovery', async () => {
    await ctx.queue.redis.set(FLAG_KEY, String(Date.now()));
    await createJobOutbox({ jobId: 'q-only', data: { type: JobType.adhoc, payload: {} }, attempts: 5 });

    await runDrainOutboxPass();

    // queue healthy + nothing admittable → the quarantined row gets another chance and the flag clears
    const row = await ctx.db.jobOutbox.findFirst();
    expect(row?.attempts).toBe(0);
    expect(await isOverflowing()).toBe(false);
  });

  it('flushOutbox persists rows still buffered at shutdown', async () => {
    setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '100'); // no size trip — rows linger in the accumulator
    setEnvOverride('JOBS_OUTBOX_FLUSH_LINGER_MS', '60000'); // no linger flush inside the test window
    const spills = [spillToOutbox(fanRow('sd1')), spillToOutbox(fanRow('sd2'))];

    await flushOutbox();
    await Promise.all(spills);

    expect(await ctx.db.jobOutbox.count()).toBe(2);
  });

  it('rejects the spill promise when the commit fails (resolves on commit, not accumulation)', async () => {
    await createJobOutbox({ handlerName: 'cleanStaleData', jobId: 'taken', dedupeKey: 'pre' });
    // Keyed upsert tries to INSERT a row whose @unique jobId already exists → the commit throws.
    const collide: OutboxRow = {
      handlerName: 'cleanStaleData',
      jobId: 'taken',
      dedupeKey: 'fresh-lane',
      data: { type: JobType.adhoc, payload: {}, dedupeKey: 'fresh-lane' },
      options: {},
    };

    await expect(spillToOutbox(collide)).rejects.toThrow();
  });
});

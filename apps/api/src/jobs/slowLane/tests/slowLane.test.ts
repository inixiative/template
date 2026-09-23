import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { claimLane, db, getJobSupersededBy, laneKey } from '@template/db';
import { cleanupTouchedTables, createJobOutbox } from '@template/db/test';
import { setEnvOverride } from '@template/shared/utils';
import type { Job } from 'bullmq';
import { flushOutbox } from '#/jobs/outbox';
import { queue } from '#/jobs/queue';
import { admitNextSlowOutboxRow } from '#/jobs/slowLane/admitNextSlowOutboxRow';
import { bulkCapacity, claimBulkSlot } from '#/jobs/slowLane/capacity';
import { bulkSlotsKey } from '#/jobs/slowLane/config';
import { feedSlowLane } from '#/jobs/slowLane/feedSlowLane';
import { runSlowLaneJob } from '#/jobs/slowLane/runSlowLaneJob';
import { spillRefusedSlowJob } from '#/jobs/slowLane/spillRefusedSlowJob';
import { type JobData, JobLane, JobType, type WorkerContext } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const slowData = (payload: unknown = {}, dedupeKey?: string): JobData => ({
  type: JobType.adhoc,
  lane: JobLane.slow,
  payload,
  dedupeKey,
});

const contextFor = (job: Partial<Job>): WorkerContext => ({
  db,
  queue,
  job: createMockJob({ name: 'sendWebhook', data: slowData(), ...job }),
});

describe('slow lane', () => {
  const added: Array<{ name: string; data: unknown; jobId?: string }> = [];
  const failingNames = new Set<string>();
  let restore = (): void => {};

  beforeAll(() => {
    const add = spyOn(queue, 'add').mockImplementation((async (
      name: string,
      data: unknown,
      opts?: { jobId?: string },
    ) => {
      if (failingNames.has(name)) throw new Error(`add refused: ${name}`);
      added.push({ name, data, jobId: opts?.jobId });
      return { id: opts?.jobId };
    }) as never);
    restore = () => add.mockRestore();
  });

  beforeEach(() => {
    setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1000');
    setEnvOverride('JOBS_OUTBOX_FLUSH_LINGER_MS', '10000');
  });

  afterEach(async () => {
    await flushOutbox();
    added.length = 0;
    failingNames.clear();
    await queue.redis.flushdb();
    await db.jobOutbox.deleteMany({});
  });

  afterAll(async () => {
    restore();
    await cleanupTouchedTables(db);
  });

  const outboxRows = () => db.jobOutbox.findMany({ orderBy: { id: 'asc' } });

  describe('runSlowLaneJob', () => {
    it('runs the handler while holding a slot, then releases it and feeds the lane', async () => {
      setEnvOverride('BULK_SLOTS', '1');
      const ctx = contextFor({ id: 'holder' });
      const events: string[] = [];

      await runSlowLaneJob(
        ctx,
        async () => {
          events.push('run');
          expect((await bulkCapacity(queue.redis)).occupied).toBe(1);
          expect(await queue.redis.zscore(bulkSlotsKey(), 'holder')).not.toBeNull();
        },
        {
          feed: async () => {
            events.push('feed');
            expect(await queue.redis.zscore(bulkSlotsKey(), 'holder')).toBeNull();
          },
        },
      );

      expect(events).toEqual(['run', 'feed']);
      expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
    });

    it('releases the slot and still feeds when the handler throws', async () => {
      let fed = false;
      await expect(
        runSlowLaneJob(
          contextFor({ id: 'thrower' }),
          async () => {
            throw new Error('handler failed');
          },
          {
            feed: async () => {
              fed = true;
            },
          },
        ),
      ).rejects.toThrow('handler failed');

      expect(fed).toBe(true);
      expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
    });

    it('renews the lease while the handler runs longer than the lease TTL', async () => {
      setEnvOverride('BULK_LEASE_TTL_MS', '150');
      await runSlowLaneJob(
        contextFor({ id: 'long-runner' }),
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 400));
          expect((await claimBulkSlot(queue.redis, 'long-runner')).occupied).toBe(1);
        },
        { feed: async () => {} },
      );
    });

    it('refuses without a slot: never runs the handler, never feeds, spills instead', async () => {
      setEnvOverride('BULK_SLOTS', '1');
      await claimBulkSlot(queue.redis, 'someone-else');
      let ran = false;
      let fed = false;
      let spilled = false;

      await runSlowLaneJob(
        contextFor({ id: 'refused' }),
        async () => {
          ran = true;
        },
        {
          spill: async () => {
            spilled = true;
            return 'replacement';
          },
          feed: async () => {
            fed = true;
          },
        },
      );

      expect({ ran, fed, spilled }).toEqual({ ran: false, fed: false, spilled: true });
    });
  });

  describe('spillRefusedSlowJob', () => {
    it('buffers a committed slow row under a fresh id, before the linger, with only replayable options', async () => {
      const ctx = contextFor({
        id: 'refused-instance',
        data: slowData({ n: 1 }),
        opts: {
          attempts: 4,
          backoff: { type: 'exponential', delay: 10 },
          removeOnFail: true,
          delay: 5_000,
          repeat: { pattern: '* * * * *' },
          jobId: 'refused-instance',
        },
      });

      const startedAt = Date.now();
      const jobId = await spillRefusedSlowJob(ctx);

      expect(Date.now() - startedAt).toBeLessThan(1_000);
      expect(jobId).not.toBe('refused-instance');
      const [row] = await outboxRows();
      expect(row).toMatchObject({ jobId, lane: JobLane.slow, handlerName: 'sendWebhook' });
      expect(row?.options).toEqual({ attempts: 4, backoff: { type: 'exponential', delay: 10 }, removeOnFail: true });
    });

    it('moves a superseding job’s baton to the replacement id', async () => {
      const lane = laneKey('sendWebhook', 'lane-a');
      await claimLane(lane, 'refused-instance');

      const jobId = await spillRefusedSlowJob(contextFor({ id: 'refused-instance', data: slowData({}, 'lane-a') }));

      expect(await queue.redis.get(lane)).toBe(jobId);
      expect(await getJobSupersededBy('refused-instance')).toBe(jobId);
    });
    it('drops a refused job a newer claim already superseded, leaving the newer baton and row intact', async () => {
      const lane = laneKey('sendWebhook', 'lane-stale');
      await claimLane(lane, 'refused-stale');
      await claimLane(lane, 'newer-claim');

      const jobId = await spillRefusedSlowJob(
        contextFor({ id: 'refused-stale', data: slowData({ stale: true }, 'lane-stale') }),
      );

      expect(jobId).toBeNull();
      expect(await queue.redis.get(lane)).toBe('newer-claim');
      expect(await getJobSupersededBy('newer-claim')).toBeNull();
      expect(await outboxRows()).toHaveLength(0);
    });

    it('replays only the retries the refused job had left', async () => {
      await spillRefusedSlowJob(contextFor({ id: 'retried', attemptsMade: 2, opts: { attempts: 3 } }));
      await spillRefusedSlowJob(contextFor({ id: 'exhausted', attemptsMade: 5, opts: { attempts: 3 } }));

      const rows = await outboxRows();
      expect(rows.map((row) => (row.options as { attempts: number }).attempts)).toEqual([1, 1]);
    });
  });

  describe('admitNextSlowOutboxRow', () => {
    it('reports an empty lane and ignores fast rows', async () => {
      await createJobOutbox({ jobId: 'fast-row', lane: JobLane.fast });
      expect(await admitNextSlowOutboxRow()).toBe('empty');
      expect(added).toHaveLength(0);
    });

    it('admits the oldest slow row with a reserved slot and deletes it', async () => {
      await createJobOutbox({
        jobId: 'slow-1',
        lane: JobLane.slow,
        handlerName: 'sendWebhook',
        data: slowData({ n: 1 }),
      });
      await createJobOutbox({
        jobId: 'slow-2',
        lane: JobLane.slow,
        handlerName: 'sendWebhook',
        data: slowData({ n: 2 }),
      });

      expect(await admitNextSlowOutboxRow()).toBe('admitted');

      expect(added).toEqual([{ name: 'sendWebhook', data: slowData({ n: 1 }), jobId: 'slow-1' }]);
      expect(await queue.redis.zscore(bulkSlotsKey(), 'slow-1')).not.toBeNull();
      expect((await outboxRows()).map((row) => row.jobId)).toEqual(['slow-2']);
    });

    it('leaves the row buffered when no slot is free', async () => {
      setEnvOverride('BULK_SLOTS', '1');
      await claimBulkSlot(queue.redis, 'busy');
      await createJobOutbox({ jobId: 'waiting', lane: JobLane.slow, data: slowData() });

      expect(await admitNextSlowOutboxRow()).toBe('noSlot');
      expect(added).toHaveLength(0);
      expect((await outboxRows()).map((row) => row.jobId)).toEqual(['waiting']);
    });

    it('bumps attempts and frees the reserved slot when the re-add fails', async () => {
      failingNames.add('poisonHandler');
      await createJobOutbox({ jobId: 'poison', lane: JobLane.slow, handlerName: 'poisonHandler', data: slowData() });

      expect(await admitNextSlowOutboxRow()).toBe('failed');

      const [row] = await outboxRows();
      expect(row?.attempts).toBe(1);
      expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
    });

    it('drops a row a newer enqueue superseded while it was buffered', async () => {
      const lane = laneKey('sendWebhook', 'lane-s');
      await createJobOutbox({
        jobId: 'stale',
        lane: JobLane.slow,
        handlerName: 'sendWebhook',
        dedupeKey: 'lane-s',
        data: slowData({}, 'lane-s'),
      });
      await claimLane(lane, 'stale');
      await claimLane(lane, 'fresh');

      expect(await admitNextSlowOutboxRow()).toBe('superseded');
      expect(added).toHaveLength(0);
      expect(await outboxRows()).toHaveLength(0);
    });

    it('replaces a stored job id BullMQ would reject', async () => {
      await createJobOutbox({ jobId: 'legacy:bad:id:four', lane: JobLane.slow, data: slowData() });

      expect(await admitNextSlowOutboxRow()).toBe('admitted');
      expect(added[0]?.jobId).not.toBe('legacy:bad:id:four');
      expect(added[0]?.jobId).not.toContain(':');
    });

    it('never hands the same row to two concurrent admissions', async () => {
      setEnvOverride('BULK_SLOTS', '10');
      for (let i = 0; i < 4; i++) {
        await createJobOutbox({ jobId: `race-${i}`, lane: JobLane.slow, data: slowData({ i }) });
      }

      const results = await Promise.all(Array.from({ length: 6 }, () => admitNextSlowOutboxRow()));

      expect(results.filter((result) => result === 'admitted')).toHaveLength(4);
      expect(new Set(added.map((a) => a.jobId)).size).toBe(4);
      expect(await outboxRows()).toHaveLength(0);
    });
  });

  describe('feedSlowLane', () => {
    it('skips past superseded rows to admit the next live one', async () => {
      const lane = laneKey('sendWebhook', 'lane-f');
      await createJobOutbox({
        jobId: 'stale-f',
        lane: JobLane.slow,
        dedupeKey: 'lane-f',
        data: slowData({}, 'lane-f'),
      });
      await claimLane(lane, 'stale-f');
      await claimLane(lane, 'fresh-f');
      await createJobOutbox({ jobId: 'live', lane: JobLane.slow, data: slowData() });

      expect(await feedSlowLane()).toBe('admitted');
      expect(added.map((a) => a.jobId)).toEqual(['live']);
    });

    it('a finishing slow job admits the next buffered row into the slot it freed', async () => {
      setEnvOverride('BULK_SLOTS', '1');
      await createJobOutbox({ jobId: 'next-in-line', lane: JobLane.slow, data: slowData() });

      await runSlowLaneJob(contextFor({ id: 'finishing' }), async () => {
        expect(await admitNextSlowOutboxRow()).toBe('noSlot');
      });

      expect(added.map((a) => a.jobId)).toEqual(['next-in-line']);
      expect(await queue.redis.zscore(bulkSlotsKey(), 'next-in-line')).not.toBeNull();
      expect(await outboxRows()).toHaveLength(0);
    });
  });
});

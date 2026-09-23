import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { db, redisNamespace } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { setEnvOverride } from '@template/shared/utils';
import { admitEnvelope } from '#/jobs/admitEnvelope';
import { queue } from '#/jobs/queue';
import { bulkCapacity, claimBulkSlot } from '#/jobs/slowLane/capacity';
import { bulkSlotsKey } from '#/jobs/slowLane/config';
import { type JobData, JobLane, JobType } from '#/jobs/types';

const FLAG_KEY = `${redisNamespace.job}:overflow`;

const envelope = (lane: JobLane): JobData => ({ type: JobType.adhoc, lane, payload: { lane } });

describe('admitEnvelope', () => {
  const added: Array<{ name: string; jobId?: string; delay?: number }> = [];
  let failAdds = false;
  let restore = (): void => {};

  beforeAll(() => {
    const add = spyOn(queue, 'add').mockImplementation((async (
      name: string,
      _data: unknown,
      opts?: { jobId?: string; delay?: number },
    ) => {
      if (failAdds) throw new Error('add failed');
      added.push({ name, jobId: opts?.jobId, delay: opts?.delay });
      return { id: opts?.jobId };
    }) as never);
    const counts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({ waiting: 0, active: 0 })) as never);
    restore = () => {
      add.mockRestore();
      counts.mockRestore();
    };
  });

  afterEach(async () => {
    added.length = 0;
    failAdds = false;
    await queue.redis.flushdb();
    await db.jobOutbox.deleteMany({});
  });

  afterAll(async () => {
    restore();
    await cleanupTouchedTables(db);
  });

  const admit = (lane: JobLane, jobId: string, options: { delay?: number } = {}, bypass = false) =>
    admitEnvelope({ handlerName: 'sendWebhook', jobId, data: envelope(lane), options, bypass });

  it('adds a slow job to BullMQ only after reserving a slot for its id', async () => {
    const result = await admit(JobLane.slow, 'slow-with-slot');

    expect(result).toEqual({ jobId: 'slow-with-slot' });
    expect(added.map((a) => a.jobId)).toEqual(['slow-with-slot']);
    expect(await queue.redis.zscore(bulkSlotsKey(), 'slow-with-slot')).not.toBeNull();
  });

  it('buffers a slow job in the outbox when no slot is free, never in BullMQ', async () => {
    setEnvOverride('BULK_SLOTS', '1');
    setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1');
    await claimBulkSlot(queue.redis, 'busy');

    const result = await admit(JobLane.slow, 'slow-without-slot');

    expect(result).toEqual({ jobId: 'slow-without-slot', outboxed: true });
    expect(added).toHaveLength(0);
    const [row] = await db.jobOutbox.findMany();
    expect(row).toMatchObject({ jobId: 'slow-without-slot', lane: JobLane.slow });
  });

  it('admits a slow job that holds a slot even while the overflow flag is up', async () => {
    await queue.redis.set(FLAG_KEY, String(Date.now()));

    await admit(JobLane.slow, 'slow-during-overflow');

    expect(added.map((a) => a.jobId)).toEqual(['slow-during-overflow']);
  });

  it('adds a delayed slow job without reserving a slot — it claims when it starts', async () => {
    await admit(JobLane.slow, 'slow-delayed', { delay: 60_000 });

    expect(added).toEqual([{ name: 'sendWebhook', jobId: 'slow-delayed', delay: 60_000 }]);
    expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
  });

  it('frees the reserved slot when the add fails', async () => {
    failAdds = true;

    await expect(admit(JobLane.slow, 'slow-add-fails')).rejects.toThrow('add failed');

    expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
  });

  it('keeps fast routing unchanged: direct normally, outbox while overflowing', async () => {
    setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1');
    await admit(JobLane.fast, 'fast-direct');
    await queue.redis.set(FLAG_KEY, String(Date.now()));
    const spilled = await admit(JobLane.fast, 'fast-spilled');

    expect(added.map((a) => a.jobId)).toEqual(['fast-direct']);
    expect(spilled.outboxed).toBe(true);
    const [row] = await db.jobOutbox.findMany();
    expect(row).toMatchObject({ jobId: 'fast-spilled', lane: JobLane.fast });
    expect((await bulkCapacity(queue.redis)).occupied).toBe(0);
  });
});

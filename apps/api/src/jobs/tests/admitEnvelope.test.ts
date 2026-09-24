import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { db } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { setEnvOverride } from '@template/shared/utils';
import { admitEnvelope } from '#/jobs/admitEnvelope';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { flagKey } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { type JobData, JobLane, JobType } from '#/jobs/types';

const envelope = (lane: JobLane): JobData => ({ type: JobType.adhoc, lane, payload: { lane } });

describe('admitEnvelope', () => {
  const added: Array<{ jobId?: string; priority?: number }> = [];
  const counts = { waiting: 0, prioritized: 0, active: 0 };
  let restore = (): void => {};

  beforeAll(() => {
    const add = spyOn(queue, 'add').mockImplementation((async (
      _name: string,
      _data: unknown,
      opts?: { jobId?: string; priority?: number },
    ) => {
      added.push({ jobId: opts?.jobId, priority: opts?.priority });
      return { id: opts?.jobId };
    }) as never);
    const getJobCounts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({ ...counts })) as never);
    restore = () => {
      add.mockRestore();
      getJobCounts.mockRestore();
    };
  });

  beforeEach(() => setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1'));

  afterEach(async () => {
    added.length = 0;
    Object.assign(counts, { waiting: 0, prioritized: 0, active: 0 });
    await queue.redis.flushdb();
    await db.jobOutbox.deleteMany({});
  });

  afterAll(async () => {
    restore();
    await cleanupTouchedTables(db);
  });

  const admit = (lane: JobLane, jobId: string, options: { priority?: number } = {}) =>
    admitEnvelope({ handlerName: 'sendWebhook', jobId, data: envelope(lane), options, bypass: false });

  it('adds a slow job straight to the shared queue at the lowest priority', async () => {
    const result = await admit(JobLane.slow, 'slow-job');

    expect(result).toEqual({ jobId: 'slow-job' });
    expect(added).toEqual([{ jobId: 'slow-job', priority: SLOW_LANE_PRIORITY }]);
  });

  it('leaves a fast job unprioritized, and a slow job always at the slow priority', async () => {
    await admit(JobLane.fast, 'fast-job');
    await admit(JobLane.fast, 'fast-urgent', { priority: 1 });
    await admit(JobLane.slow, 'slow-asked-urgent', { priority: 1 });

    expect(added.map((a) => a.priority)).toEqual([undefined, 1, SLOW_LANE_PRIORITY]);
  });

  it('spills slow work once the slow lane is over pressure, while fast work still goes direct', async () => {
    await queue.redis.set(flagKey(JobLane.slow), String(Date.now()));

    await admit(JobLane.fast, 'fast-direct');
    const spilled = await admit(JobLane.slow, 'slow-spilled');

    expect(added.map((a) => a.jobId)).toEqual(['fast-direct']);
    expect(spilled.outboxed).toBe(true);
    const [row] = await db.jobOutbox.findMany();
    expect(row).toMatchObject({ jobId: 'slow-spilled', lane: JobLane.slow });
    expect((row?.options as { priority?: number }).priority).toBe(SLOW_LANE_PRIORITY);
  });

  it('spills both lanes when the whole budget is over pressure', async () => {
    await queue.redis.set(flagKey(JobLane.fast), String(Date.now()));

    await admit(JobLane.fast, 'fast-spilled');
    await admit(JobLane.slow, 'slow-spilled');

    expect(added).toHaveLength(0);
    expect((await db.jobOutbox.findMany({ orderBy: { id: 'asc' } })).map((row) => [row.jobId, row.lane])).toEqual([
      ['fast-spilled', JobLane.fast],
      ['slow-spilled', JobLane.slow],
    ]);
  });

  it('trips the slow flag when prioritized work reaches the slow share, and the budget flag at the total cap', async () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '10');
    setEnvOverride('JOBS_SLOW_QUEUE_DEPTH_FRACTION', '0.5');

    Object.assign(counts, { waiting: 0, prioritized: 5, active: 0 });
    await admit(JobLane.slow, 'slow-at-share');
    expect(await queue.redis.get(flagKey(JobLane.slow))).not.toBeNull();
    expect(await queue.redis.get(flagKey(JobLane.fast))).toBeNull();

    Object.assign(counts, { waiting: 3, prioritized: 5, active: 2 });
    await admit(JobLane.fast, 'fast-at-cap');
    expect(await queue.redis.get(flagKey(JobLane.fast))).not.toBeNull();
  });
});

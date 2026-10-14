import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { claimLane, db, getJobSupersededBy, laneKey } from '@template/db';
import { cleanupTouchedTables } from '@template/db/test';
import { log } from '@template/shared/logger';
import { setEnvOverride } from '@template/shared/utils';
import { type Job, PRIORITY_LIMIT } from 'bullmq';
import { enqueueOrSpill } from '#/jobs/enqueueOrSpill';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { flagKey } from '#/jobs/outbox/config';
import { queue } from '#/jobs/queue';
import { readSlowDeferred } from '#/jobs/slowLaneSignals';
import { type JobData, JobLane, type JobOptions, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const envelope = (lane: JobLane): JobData => ({ type: JobType.adhoc, lane, payload: { lane } });

describe('enqueueOrSpill', () => {
  const added: Array<{ jobId?: string; priority?: number; deduplication?: { id: string } }> = [];
  const counts = { waiting: 0, prioritized: 0, active: 0 };
  // BullMQ answers a deduplicated add with the id of the job already holding the deduplication id.
  const holders = new Map<string, string>();
  let restore = (): void => {};

  beforeAll(() => {
    const add = spyOn(queue, 'add').mockImplementation((async (
      _name: string,
      _data: unknown,
      opts?: { jobId?: string; priority?: number; deduplication?: { id: string } },
    ) => {
      const holder = opts?.deduplication && holders.get(opts.deduplication.id);
      if (holder) return { id: holder };
      added.push({
        jobId: opts?.jobId,
        priority: opts?.priority,
        deduplication: opts?.deduplication,
      });
      if (opts?.deduplication && opts.jobId) holders.set(opts.deduplication.id, opts.jobId);
      return { id: opts?.jobId };
    }) as never);
    const getJobCounts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({
      ...counts,
    })) as never);
    const getCountsPerPriority = spyOn(queue, 'getCountsPerPriority').mockImplementation(
      (async () => ({
        [SLOW_LANE_PRIORITY]: counts.prioritized,
      })) as never,
    );
    restore = () => {
      add.mockRestore();
      getJobCounts.mockRestore();
      getCountsPerPriority.mockRestore();
    };
  });

  beforeEach(() => setEnvOverride('JOBS_OUTBOX_FLUSH_MAX_ROWS', '1'));

  afterEach(async () => {
    added.length = 0;
    holders.clear();
    Object.assign(counts, { waiting: 0, prioritized: 0, active: 0 });
    await queue.redis.flushdb();
    await cleanupTouchedTables(db);
  });

  afterAll(async () => {
    restore();
    await cleanupTouchedTables(db);
  });

  const place = (
    lane: JobLane,
    jobId: string,
    options: Pick<JobOptions, 'priority' | 'delay' | 'parent'> = {},
  ) =>
    enqueueOrSpill({
      handlerName: 'sendWebhook',
      jobId,
      data: envelope(lane),
      options,
      bypass: false,
    });

  it('adds a slow job straight to the shared queue at the lowest priority', async () => {
    const result = await place(JobLane.slow, 'slow-job');

    expect(result).toEqual({ jobId: 'slow-job' });
    expect(added).toEqual([{ jobId: 'slow-job', priority: SLOW_LANE_PRIORITY }]);
  });

  it('leaves a fast job unprioritized, and a slow job always at the slow priority', async () => {
    await place(JobLane.fast, 'fast-job');
    await place(JobLane.fast, 'fast-urgent', { priority: 1 });
    await place(JobLane.slow, 'slow-asked-urgent', { priority: 1 });

    expect(added.map((a) => a.priority)).toEqual([undefined, 1, SLOW_LANE_PRIORITY]);
  });

  it('clamps a requested priority above the slow lane to the slow priority', async () => {
    await place(JobLane.fast, 'fast-asked-last', { priority: PRIORITY_LIMIT });

    expect(added.map((a) => a.priority)).toEqual([SLOW_LANE_PRIORITY]);
  });

  it('counts a slow job added with a delay as deferred slow work from the moment it is added', async () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '2');
    setEnvOverride('JOBS_SLOW_QUEUE_DEPTH_FRACTION', '0.5');

    await place(JobLane.fast, 'fast-delayed', { delay: 30_000 });
    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(0);

    await place(JobLane.slow, 'slow-delayed', { delay: 30_000 });
    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(1);
    expect(await queue.redis.get(flagKey(JobLane.slow))).not.toBeNull();
  });

  it('spills slow work once the slow lane is over pressure, while fast work still goes direct', async () => {
    await queue.redis.set(flagKey(JobLane.slow), String(Date.now()));

    await place(JobLane.fast, 'fast-direct');
    const spilled = await place(JobLane.slow, 'slow-spilled');

    expect(added.map((a) => a.jobId)).toEqual(['fast-direct']);
    expect(spilled.outboxed).toBe(true);
    const [row] = await db.jobOutbox.findMany();
    expect(row).toMatchObject({ jobId: 'slow-spilled', lane: JobLane.slow });
    expect((row?.options as { priority?: number }).priority).toBe(SLOW_LANE_PRIORITY);
  });

  it('adds a flow child straight to the queue even when its lane is over pressure', async () => {
    await queue.redis.set(flagKey(JobLane.fast), String(Date.now()));

    const result = await place(JobLane.fast, 'flow-child', {
      parent: { id: 'parent-job', queue: 'bull:jobs' },
    });

    expect(result).toEqual({ jobId: 'flow-child' });
    expect(added.map((a) => a.jobId)).toEqual(['flow-child']);
    expect(await db.jobOutbox.findMany()).toHaveLength(0);
  });

  it('spills both lanes when the whole budget is over pressure', async () => {
    await queue.redis.set(flagKey(JobLane.fast), String(Date.now()));

    await place(JobLane.fast, 'fast-spilled');
    await place(JobLane.slow, 'slow-spilled');

    expect(added).toHaveLength(0);
    expect(
      (await db.jobOutbox.findMany({ orderBy: { id: 'asc' } })).map((row) => [row.jobId, row.lane]),
    ).toEqual([
      ['fast-spilled', JobLane.fast],
      ['slow-spilled', JobLane.slow],
    ]);
  });

  it('trips the slow flag when prioritized work reaches the slow share, and the budget flag at the total cap', async () => {
    setEnvOverride('JOBS_MAX_QUEUE_DEPTH', '10');
    setEnvOverride('JOBS_SLOW_QUEUE_DEPTH_FRACTION', '0.5');

    Object.assign(counts, { waiting: 0, prioritized: 5, active: 0 });
    await place(JobLane.slow, 'slow-at-share');
    expect(await queue.redis.get(flagKey(JobLane.slow))).not.toBeNull();
    expect(await queue.redis.get(flagKey(JobLane.fast))).toBeNull();

    Object.assign(counts, { waiting: 3, prioritized: 5, active: 2 });
    await place(JobLane.fast, 'fast-at-cap');
    expect(await queue.redis.get(flagKey(JobLane.fast))).not.toBeNull();
  });

  describe('singletons', () => {
    const placeSingleton = (jobId: string, singletonKey: string) =>
      enqueueOrSpill({
        handlerName: 'cleanStaleData',
        jobId,
        data: envelope(JobLane.fast),
        options: {},
        bypass: false,
        singletonKey,
      });

    it('adds a singleton with its deduplication id, and a second add for the key returns the holder', async () => {
      const first = await placeSingleton('first-run', 'cron-row');
      const second = await placeSingleton('second-run', 'cron-row');

      expect(first).toEqual({ jobId: 'first-run' });
      expect(second).toEqual({ jobId: 'first-run' });
      expect(added).toEqual([
        { jobId: 'first-run', deduplication: { id: 'cleanStaleData-cron-row' } },
      ]);
    });

    it('keeps the deduplication id on a singleton spilled to the outbox', async () => {
      await queue.redis.set(flagKey(JobLane.fast), String(Date.now()));

      await placeSingleton('spilled-run', 'cron-row');

      const [row] = await db.jobOutbox.findMany();
      expect((row?.options as { deduplication?: { id: string } }).deduplication).toEqual({
        id: 'cleanStaleData-cron-row',
      });
    });
  });

  describe('a staged superseding job replacing a parked copy', () => {
    const DEDUPE_KEY = 'cache-a';
    const lane = laneKey('sendWebhook', DEDUPE_KEY);
    const child = createMockJob({
      id: 'old-child',
      name: 'refreshTarget',
      data: { type: JobType.adhoc, lane: JobLane.slow, payload: {}, dedupeKey: 'target-1' },
    });
    const oldParent = createMockJob({
      id: 'old-parent',
      name: 'sendWebhook',
      queueQualifiedName: 'bull:jobs',
    } as Partial<Job>);
    oldParent.getState = (async () => 'waiting-children') as Job['getState'];
    oldParent.getDependencies = async () => ({
      unprocessed: ['bull:jobs:old-child'],
      nextUnprocessedCursor: 0,
    });

    const placeStaged = (jobId: string) =>
      enqueueOrSpill({
        handlerName: 'sendWebhook',
        jobId,
        data: { ...envelope(JobLane.fast), dedupeKey: DEDUPE_KEY },
        options: {},
        bypass: false,
        isStaged: true,
      });

    it('evicts the unfinished children of the parked copy through their lanes', async () => {
      await claimLane(lane, 'old-parent');
      await claimLane(laneKey(child.name, 'target-1'), 'old-child');
      const getJob = spyOn(queue, 'getJob').mockImplementation((async (id: string) =>
        [oldParent, child].find((job) => job.id === id)) as never);

      try {
        expect(await placeStaged('new-parent')).toEqual({ jobId: 'new-parent' });
      } finally {
        getJob.mockRestore();
      }

      expect(await getJobSupersededBy('old-parent')).toBe('new-parent');
      expect(await getJobSupersededBy('old-child')).toBe('evicted-old-parent');
    });

    it('logs a failed eviction and still places the new job', async () => {
      await claimLane(lane, 'old-parent');
      const evictionError = new Error('redis unavailable');
      const getJob = spyOn(queue, 'getJob').mockImplementation((async () => {
        throw evictionError;
      }) as never);
      const logError = spyOn(log, 'error').mockImplementation(() => {});

      try {
        expect(await placeStaged('new-parent')).toEqual({ jobId: 'new-parent' });
        expect(logError).toHaveBeenCalledWith(
          'Failed to evict the children of superseded flow old-parent (sendWebhook)',
          evictionError,
          expect.anything(),
        );
      } finally {
        getJob.mockRestore();
        logError.mockRestore();
      }

      expect(added.map((a) => a.jobId)).toEqual(['new-parent']);
      expect(await getJobSupersededBy('old-parent')).toBe('new-parent');
    });
  });
});

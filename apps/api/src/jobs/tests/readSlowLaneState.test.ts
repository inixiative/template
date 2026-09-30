import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { laneDepthsFrom } from '#/jobs/outbox/queueDepth';
import { queue } from '#/jobs/queue';
import { readSlowLaneState } from '#/jobs/readSlowLaneState';
import { recordSlowDeferral, recordSlowFinished, SLOW_DEFERRED_GRACE_MS } from '#/jobs/slowLaneSignals';

describe('laneDepthsFrom', () => {
  it('caps the deferral list at the delayed count, so a promoted job waiting to be fetched is not counted twice', () => {
    expect(laneDepthsFrom({ waiting: 1, prioritized: 4, delayed: 3 }, 4, 5)).toEqual({
      total: 1 + 4 + 3,
      slow: 4 + 3,
      slowDeferred: 3,
    });
  });

  it('falls back to the list when delayed was not read', () => {
    expect(laneDepthsFrom({ waiting: 2 }, 0, 4)).toEqual({ total: 2 + 4, slow: 4, slowDeferred: 4 });
  });
});

describe('readSlowLaneState', () => {
  const counts = { waiting: 0, prioritized: 0, active: 0, delayed: 0 };
  let restore = (): void => {};

  beforeAll(() => {
    const getJobCounts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({ ...counts })) as never);
    const getCountsPerPriority = spyOn(queue, 'getCountsPerPriority').mockImplementation((async () => ({
      [SLOW_LANE_PRIORITY]: counts.prioritized,
    })) as never);
    restore = () => {
      getJobCounts.mockRestore();
      getCountsPerPriority.mockRestore();
    };
  });

  afterEach(async () => {
    Object.assign(counts, { waiting: 0, prioritized: 0, active: 0, delayed: 0 });
    await queue.redis.flushdb();
  });

  afterAll(() => restore());

  it('counts slow jobs deferred into delayed as queued slow work, in the slow count and the whole budget', async () => {
    Object.assign(counts, { waiting: 1, prioritized: 2, delayed: 9 });
    for (let i = 0; i < 6; i++) await recordSlowDeferral(queue.redis, queue.name, `parked-${i}`, Date.now() + 20_000);

    const state = await readSlowLaneState();

    expect(state.deferred).toBe(6);
    expect(state.queued).toBe(2 + 6);
    expect(state.depths).toEqual({ total: 1 + 2 + 6, slow: 2 + 6, slowDeferred: 6 });
  });

  it('prunes entries no worker picked up within the grace', async () => {
    const now = Date.now();
    Object.assign(counts, { delayed: 5 });
    await recordSlowDeferral(queue.redis, queue.name, 'orphaned', now - SLOW_DEFERRED_GRACE_MS - 1);
    await recordSlowDeferral(queue.redis, queue.name, 'parked', now + 1_000);

    expect((await readSlowLaneState(now)).deferred).toBe(1);
    expect(await queue.redis.zcard(`job:${queue.name}:slow:deferred`)).toBe(1);
  });

  it('reads the idle clock against the slow count: 0 while nothing slow is queued, then time since a finish', async () => {
    await recordSlowFinished(queue.redis, queue.name, 1_000);
    expect((await readSlowLaneState(500_000)).idleMs).toBe(0);

    Object.assign(counts, { prioritized: 3 });
    await readSlowLaneState(600_000);
    await recordSlowFinished(queue.redis, queue.name, 610_000);

    expect((await readSlowLaneState(670_000)).idleMs).toBe(60_000);
  });
});

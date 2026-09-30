import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { resetEnvOverrides, setEnvOverride } from '@template/shared/utils';
import { DelayedError, type Job, WaitingError } from 'bullmq';
import { admitToSlot } from '#/jobs/admitToSlot';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { queue } from '#/jobs/queue';
import {
  readSlowDeferred,
  recordSlowDeferral,
  SLOW_PARK_MIN_MS,
  slowParkDelayMs,
} from '#/jobs/slowLaneSignals';
import { createSlowSlotPool, slowSlotCapacity } from '#/jobs/slowSlotPool';
import { JobLane, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const jobIn = (
  lane: JobLane,
  priority = lane === JobLane.slow ? SLOW_LANE_PRIORITY : 0,
  id = `${lane}-job`,
) =>
  createMockJob({
    id,
    name: 'sendWebhook',
    data: { type: JobType.adhoc, lane, payload: {} },
    priority,
    token: 'worker-token',
    moveToWait: mock(async () => 0),
    moveToDelayed: mock(async () => undefined),
  } as Partial<Job>);

describe('admitToSlot', () => {
  let waiting = 0;
  let restore = (): void => {};

  beforeEach(() => {
    waiting = 0;
    const getWaitingCount = spyOn(queue, 'getWaitingCount').mockImplementation(
      (async () => waiting) as never,
    );
    const getJobCounts = spyOn(queue, 'getJobCounts').mockImplementation((async () => ({
      waiting,
    })) as never);
    const getCountsPerPriority = spyOn(queue, 'getCountsPerPriority').mockImplementation(
      (async () => ({})) as never,
    );
    restore = () => {
      getWaitingCount.mockRestore();
      getJobCounts.mockRestore();
      getCountsPerPriority.mockRestore();
    };
  });

  afterEach(async () => {
    restore();
    await queue.redis.flushdb();
  });

  it('admits a fast job without touching the slow slots or the queue', async () => {
    const slots = createSlowSlotPool(4);
    const release = await admitToSlot(jobIn(JobLane.fast), queue, slots);
    release();
    expect(slots.held()).toBe(0);
    expect(queue.getWaitingCount).not.toHaveBeenCalled();
  });

  it('holds a slow slot for the run and frees it on release', async () => {
    const slots = createSlowSlotPool(4);
    const release = await admitToSlot(jobIn(JobLane.slow), queue, slots);
    expect(slots.held()).toBe(1);
    release();
    expect(slots.held()).toBe(0);
  });

  it('parks a slow job in delayed when the slow half is full, and counts it as deferred slow work', async () => {
    const slots = createSlowSlotPool(4);
    await admitToSlot(jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'first'), queue, slots);
    await admitToSlot(jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'second'), queue, slots);
    const third = jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'third');
    const before = Date.now();

    await expect(admitToSlot(third, queue, slots)).rejects.toBeInstanceOf(DelayedError);

    expect(slots.held()).toBe(2);
    const [timestamp, token] = (third.moveToDelayed as ReturnType<typeof mock>).mock.calls[0] as [
      number,
      string,
    ];
    expect(token).toBe('worker-token');
    expect(timestamp).toBeGreaterThanOrEqual(before + SLOW_PARK_MIN_MS);
    expect(timestamp).toBeLessThanOrEqual(Date.now() + process.env.JOBS_SLOW_PARK_MAX_MS);
    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(1);
  });

  it('a parked slow job leaves the deferred count when a worker picks it back up and admits it', async () => {
    const slots = createSlowSlotPool(2);
    const parked = jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'parked');
    const releaseFirst = await admitToSlot(
      jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'first'),
      queue,
      slots,
    );
    await expect(admitToSlot(parked, queue, slots)).rejects.toBeInstanceOf(DelayedError);
    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(1);

    releaseFirst();
    const release = await admitToSlot(parked, queue, slots);

    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(0);
    release();
  });

  it('a slow line-jumper sent back to its band leaves the deferred count', async () => {
    await recordSlowDeferral(queue.redis, queue.name, 'jumper', Date.now() - 1_000);
    waiting = 1;

    await expect(
      admitToSlot(jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'jumper'), queue, createSlowSlotPool(4)),
    ).rejects.toBeInstanceOf(WaitingError);

    expect(await readSlowDeferred(queue.redis, queue.name)).toBe(0);
  });

  it('still parks the job when the deferral list cannot be written', async () => {
    const zadd = spyOn(queue.redis, 'zadd').mockImplementation((async () => {
      throw new Error('redis down');
    }) as never);
    const slots = createSlowSlotPool(2);
    await admitToSlot(jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'first'), queue, slots);
    const refused = jobIn(JobLane.slow, SLOW_LANE_PRIORITY, 'refused');

    try {
      await expect(admitToSlot(refused, queue, slots)).rejects.toBeInstanceOf(DelayedError);
      expect(refused.moveToDelayed).toHaveBeenCalledTimes(1);
    } finally {
      zadd.mockRestore();
    }
  });

  it('moves a prioritized job that started ahead of waiting fast work back to its priority', async () => {
    waiting = 3;
    const slots = createSlowSlotPool(4);
    const jumped = jobIn(JobLane.slow);

    await expect(admitToSlot(jumped, queue, slots)).rejects.toBeInstanceOf(WaitingError);

    expect(jumped.moveToWait).toHaveBeenCalledWith('worker-token');
    expect(slots.held()).toBe(0);
  });

  it('runs a prioritized job that started with no fast work waiting', async () => {
    const between = jobIn(JobLane.fast, 5);
    const release = await admitToSlot(between, queue, createSlowSlotPool(4));
    release();
    expect(between.moveToWait).not.toHaveBeenCalled();
  });
});

describe('slowParkDelayMs', () => {
  afterEach(() => resetEnvOverrides());

  it('spreads the park further the more slow work is queued, up to the configured ceiling', () => {
    setEnvOverride('JOBS_SLOW_PARK_MAX_MS', '60000');
    expect(slowParkDelayMs(0, () => 0.999)).toBe(SLOW_PARK_MIN_MS);
    expect(slowParkDelayMs(500, () => 0.999)).toBeGreaterThan(9_000);
    expect(slowParkDelayMs(500, () => 0.999)).toBeLessThanOrEqual(10_000);
    expect(slowParkDelayMs(100_000, () => 0.999)).toBeLessThanOrEqual(60_000);
    expect(slowParkDelayMs(100_000, () => 0.999)).toBeGreaterThan(59_000);
    expect(slowParkDelayMs(100_000, () => 0)).toBe(SLOW_PARK_MIN_MS);
    setEnvOverride('JOBS_SLOW_PARK_MAX_MS', '5000');
    expect(slowParkDelayMs(100_000, () => 0.999)).toBeLessThanOrEqual(5_000);
  });
});

describe('slowSlotCapacity', () => {
  afterEach(() => resetEnvOverrides());

  it('is the slow fraction of the worker concurrency, never below one slot', () => {
    setEnvOverride('JOBS_SLOW_SLOT_FRACTION', '0.5');
    expect(slowSlotCapacity(10)).toBe(5);
    expect(slowSlotCapacity(3)).toBe(1);
    setEnvOverride('JOBS_SLOW_SLOT_FRACTION', '0');
    expect(slowSlotCapacity(10)).toBe(1);
    setEnvOverride('JOBS_SLOW_SLOT_FRACTION', '1');
    expect(slowSlotCapacity(10)).toBe(10);
  });
});

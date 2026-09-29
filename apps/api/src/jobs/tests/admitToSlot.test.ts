import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { resetEnvOverrides, setEnvOverride } from '@template/shared/utils';
import { DelayedError, type Job, WaitingError } from 'bullmq';
import { admitToSlot, SLOW_SLOT_RETRY_MS } from '#/jobs/admitToSlot';
import { SLOW_LANE_PRIORITY } from '#/jobs/lanePriority';
import { queue } from '#/jobs/queue';
import { createSlowSlotPool, slowSlotCapacity } from '#/jobs/slowSlotPool';
import { JobLane, JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

const jobIn = (lane: JobLane, priority = lane === JobLane.slow ? SLOW_LANE_PRIORITY : 0) =>
  createMockJob({
    id: `${lane}-job`,
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
    const getWaitingCount = spyOn(queue, 'getWaitingCount').mockImplementation((async () => waiting) as never);
    restore = () => getWaitingCount.mockRestore();
  });

  afterEach(() => restore());

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

  it('sends a slow job back to delayed at its priority when the slow half is full', async () => {
    const slots = createSlowSlotPool(4);
    await admitToSlot(jobIn(JobLane.slow), queue, slots);
    await admitToSlot(jobIn(JobLane.slow), queue, slots);
    const third = jobIn(JobLane.slow);
    const before = Date.now();

    await expect(admitToSlot(third, queue, slots)).rejects.toBeInstanceOf(DelayedError);

    expect(slots.held()).toBe(2);
    const [timestamp, token] = (third.moveToDelayed as ReturnType<typeof mock>).mock.calls[0] as [number, string];
    expect(token).toBe('worker-token');
    expect(timestamp).toBeGreaterThanOrEqual(before + SLOW_SLOT_RETRY_MS);
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

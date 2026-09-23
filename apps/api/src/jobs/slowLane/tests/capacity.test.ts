import { afterEach, describe, expect, it } from 'bun:test';
import { setEnvOverride } from '@template/shared/utils';
import { queue } from '#/jobs/queue';
import { bulkCapacity, claimBulkSlot, releaseBulkSlot, renewBulkSlot } from '#/jobs/slowLane/capacity';
import { bulkSlotsKey, workerInstanceId, workerPresenceKey } from '#/jobs/slowLane/config';
import { isWorkerPresenceRunning, startWorkerPresence, stopWorkerPresence } from '#/jobs/slowLane/presence';

const redis = queue.redis;

const addLiveWorkers = async (count: number): Promise<void> => {
  for (let i = 0; i < count; i++) await redis.zadd(workerPresenceKey(), String(Date.now() + 60_000), `worker-${i}`);
};

describe('slow-lane capacity', () => {
  afterEach(async () => {
    await stopWorkerPresence();
    await redis.flushdb();
  });

  it('floors the cap at one slot when no worker is live', async () => {
    const capacity = await bulkCapacity(redis);
    expect(capacity).toEqual({ claimed: false, cap: 1, occupied: 0, liveWorkers: 0 });
  });

  it('scales the cap with live workers: floor(concurrency × fraction × workers)', async () => {
    setEnvOverride('JOBS_WORKER_CONCURRENCY', '10');
    setEnvOverride('BULK_SLOT_FRACTION', '0.5');
    await addLiveWorkers(3);

    expect((await bulkCapacity(redis)).cap).toBe(15);
  });

  it('uses BULK_SLOTS as a fixed fleet-wide cap when set', async () => {
    setEnvOverride('BULK_SLOTS', '3');
    await addLiveWorkers(4);

    expect((await bulkCapacity(redis)).cap).toBe(3);
  });

  it('claims up to the cap, refuses past it, and renews a member already holding a lease at the cap', async () => {
    setEnvOverride('BULK_SLOTS', '2');

    expect((await claimBulkSlot(redis, 'a')).claimed).toBe(true);
    expect((await claimBulkSlot(redis, 'b')).claimed).toBe(true);
    const refused = await claimBulkSlot(redis, 'c');
    expect(refused).toMatchObject({ claimed: false, cap: 2, occupied: 2 });

    const renewed = await claimBulkSlot(redis, 'a');
    expect(renewed).toMatchObject({ claimed: true, occupied: 2 });
  });

  it('frees a slot on release and evicts an expired lease on the next read', async () => {
    setEnvOverride('BULK_SLOTS', '1');
    await claimBulkSlot(redis, 'held');
    await releaseBulkSlot(redis, 'held');
    expect((await claimBulkSlot(redis, 'next')).claimed).toBe(true);

    await redis.zadd(bulkSlotsKey(), String(Date.now() - 1), 'next');
    expect((await claimBulkSlot(redis, 'after-expiry')).claimed).toBe(true);
    expect(await redis.zscore(bulkSlotsKey(), 'next')).toBeNull();
  });

  it('reports a renewal that had to re-add an evicted member', async () => {
    await claimBulkSlot(redis, 'renewed');
    expect(await renewBulkSlot(redis, 'renewed')).toEqual({ reacquired: false });

    await redis.zrem(bulkSlotsKey(), 'renewed');
    expect(await renewBulkSlot(redis, 'renewed')).toEqual({ reacquired: true });
  });

  it('drops expired worker presence before computing the cap', async () => {
    setEnvOverride('JOBS_WORKER_CONCURRENCY', '4');
    setEnvOverride('BULK_SLOT_FRACTION', '1');
    await addLiveWorkers(1);
    await redis.zadd(workerPresenceKey(), String(Date.now() - 1), 'dead-worker');

    expect(await bulkCapacity(redis)).toMatchObject({ cap: 4, liveWorkers: 1 });
  });
});

describe('worker presence', () => {
  afterEach(async () => {
    await stopWorkerPresence();
    await redis.flushdb();
  });

  it('starts nothing at import and registers this worker when started', async () => {
    expect(isWorkerPresenceRunning()).toBe(false);

    await startWorkerPresence();

    expect(isWorkerPresenceRunning()).toBe(true);
    expect(await redis.zscore(workerPresenceKey(), workerInstanceId())).not.toBeNull();
    expect((await bulkCapacity(redis)).liveWorkers).toBe(1);
  });

  it('removes this worker and stops refreshing when stopped', async () => {
    await startWorkerPresence();
    await stopWorkerPresence();

    expect(isWorkerPresenceRunning()).toBe(false);
    expect(await redis.zscore(workerPresenceKey(), workerInstanceId())).toBeNull();
  });
});

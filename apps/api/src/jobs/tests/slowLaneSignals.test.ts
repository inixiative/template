import { afterEach, describe, expect, it } from 'bun:test';
import { queue } from '#/jobs/queue';
import {
  pruneSlowDeferred,
  readSlowDeferred,
  readSlowIdleMs,
  recordSlowDeferral,
  recordSlowFinished,
  releaseSlowDeferral,
  SLOW_DEFERRED_GRACE_MS,
  slowDeferredKey,
} from '#/jobs/slowLaneSignals';

const redis = queue.redis;
const queueName = () => `signals-test-${Bun.randomUUIDv7()}`;

afterEach(async () => {
  await redis.flushdb();
});

describe('slow-lane deferral list', () => {
  it('counts each deferred slow job once, however many times it is parked again', async () => {
    const name = queueName();
    const now = Date.now();
    await recordSlowDeferral(redis, name, 'a', now + 2_000);
    await recordSlowDeferral(redis, name, 'b', now + 5_000);
    await recordSlowDeferral(redis, name, 'a', now + 9_000);

    expect(await readSlowDeferred(redis, name, now)).toBe(2);
  });

  it('keeps a job counted after its due time until a worker picks it back up', async () => {
    const name = queueName();
    const now = Date.now();
    await recordSlowDeferral(redis, name, 'late', now - 20_000);

    expect(await readSlowDeferred(redis, name, now)).toBe(1);

    await releaseSlowDeferral(redis, name, 'late');
    expect(await readSlowDeferred(redis, name, now)).toBe(0);
  });

  it('stops counting an entry past its due time by more than the grace, and prunes it', async () => {
    const name = queueName();
    const now = Date.now();
    await recordSlowDeferral(redis, name, 'orphaned', now - SLOW_DEFERRED_GRACE_MS - 1);
    await recordSlowDeferral(redis, name, 'waiting', now + 1_000);

    expect(await readSlowDeferred(redis, name, now)).toBe(1);
    await pruneSlowDeferred(redis, name, now);
    expect(await redis.zcard(slowDeferredKey(name))).toBe(1);
  });

  it('keeps a separate list per queue', async () => {
    const [first, second] = [queueName(), queueName()];
    await recordSlowDeferral(redis, first, 'x', Date.now() + 1_000);

    expect(await readSlowDeferred(redis, second)).toBe(0);
  });
});

describe('slow-lane idle clock', () => {
  it('is 0 while no slow work is queued', async () => {
    const name = queueName();
    await recordSlowFinished(redis, name, 1_000);

    expect(await readSlowIdleMs(redis, name, 0, 500_000)).toBe(0);
  });

  it('counts from the last slow finish while slow work is queued', async () => {
    const name = queueName();
    await readSlowIdleMs(redis, name, 4, 1_000);
    await recordSlowFinished(redis, name, 10_000);

    expect(await readSlowIdleMs(redis, name, 4, 70_000)).toBe(60_000);
  });

  it('starts its clock when slow work arrives on an idle lane, not at a finish from before', async () => {
    const name = queueName();
    await recordSlowFinished(redis, name, 1_000);
    await readSlowIdleMs(redis, name, 0, 2_000);

    expect(await readSlowIdleMs(redis, name, 1, 900_000)).toBe(0);
    expect(await readSlowIdleMs(redis, name, 1, 960_000)).toBe(60_000);
  });
});

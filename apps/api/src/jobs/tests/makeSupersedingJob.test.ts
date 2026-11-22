import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { claimLane, fetchSupersededBy, laneKey } from '@template/db';
import { WaitingChildrenError } from 'bullmq';
import { jobLaneStore } from '#/jobs/jobLaneStore';
import { makeSupersedingJob, type SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import type { WorkerContext } from '#/jobs/types';
import { makeTestWorker } from '#tests/makeTestWorker';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('makeSupersedingJob', () => {
  let ctx: WorkerContext;
  const createJobRecord = (jobId: string) =>
    ctx.queue.redis.hset(ctx.queue.toKey(jobId), 'name', ctx.job.name);
  const markSuperseded = (jobId: string, supersededBy: string) =>
    ctx.queue.redis.hset(ctx.queue.toKey(jobId), 'supersededBy', supersededBy);

  beforeEach(async () => {
    ctx = makeTestWorker({ id: Bun.randomUUIDv7() });
    await createJobRecord(ctx.job.id!);
  });

  afterEach(async () => {
    const redis = ctx.queue.redis;
    const keys = [...(await redis.keys('lane:*')), ...(await redis.keys(ctx.queue.toKey('*')))];
    if (keys.length > 0) await redis.del(...keys);
  });

  test('completes normally when not superseded', async () => {
    let result = 0;
    const innerHandler = mock(async (_ctx: WorkerContext, payload: { value: number }) => {
      result = payload.value * 2;
    });

    await makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, { value: 5 });

    expect(innerHandler).toHaveBeenCalledTimes(1);
    expect(result).toBe(10);
  });

  test('a job that parks waiting on its children keeps its lane for three hours', async () => {
    const handler = makeSupersedingJob<Record<string, never>>(
      async () => {
        throw new WaitingChildrenError();
      },
      () => 'parked-lane',
    );
    const lane = laneKey(ctx.job.name, 'parked-lane');

    await expect(handler(ctx, {})).rejects.toBeInstanceOf(WaitingChildrenError);

    expect(await ctx.queue.redis.get(lane)).toBe(ctx.job.id ?? null);
    const ttl = await ctx.queue.redis.ttl(lane);
    expect(ttl).toBeGreaterThan(2 * 60 * 60);
    expect(ttl).toBeLessThanOrEqual(3 * 60 * 60);
  });

  test('a parked job that was already replaced leaves the newer holder alone', async () => {
    const lane = laneKey(ctx.job.name, 'replaced-lane');
    const handler = makeSupersedingJob<Record<string, never>>(
      async () => {
        await claimLane(jobLaneStore, lane, 'newer-job');
        throw new WaitingChildrenError();
      },
      () => 'replaced-lane',
    );

    await expect(handler(ctx, {})).rejects.toBeInstanceOf(WaitingChildrenError);

    expect(await ctx.queue.redis.get(lane)).toBe('newer-job');
    expect(await ctx.queue.redis.ttl(lane)).toBeLessThanOrEqual(300);
  });

  test('a job whose own record says it was superseded exits at start, even after its lane expired', async () => {
    await markSuperseded(ctx.job.id!, Bun.randomUUIDv7());
    const innerHandler = mock(async (_ctx: WorkerContext, _payload: { value: number }) => {});

    await makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, { value: 1 });

    expect(innerHandler).not.toHaveBeenCalled();
    expect(await ctx.queue.redis.get(laneKey(ctx.job.name, 'test-1'))).toBeNull();
  });

  test('a child of a superseded parent exits at start', async () => {
    const parentId = Bun.randomUUIDv7();
    await createJobRecord(parentId);
    await markSuperseded(parentId, Bun.randomUUIDv7());
    ctx.job.parent = { id: parentId, queueKey: 'bull:jobs' };
    const innerHandler = mock(async () => {});

    await makeSupersedingJob<Record<string, never>>(innerHandler, () => 'child-lane')(ctx, {});

    expect(innerHandler).not.toHaveBeenCalled();
  });

  test('a job whose lane a newer existing job holds exits at start', async () => {
    const newer = Bun.randomUUIDv7();
    await createJobRecord(newer);
    await claimLane(jobLaneStore, laneKey(ctx.job.name, 'test-1'), newer);
    const innerHandler = mock(async (_ctx: WorkerContext, _payload: { value: number }) => {});

    await makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, { value: 1 });

    expect(innerHandler).not.toHaveBeenCalled();
  });

  test('a job that starts over an older holder takes the lane and marks the older one', async () => {
    const older = Bun.randomUUIDv7();
    ctx = makeTestWorker({ id: Bun.randomUUIDv7() });
    await createJobRecord(ctx.job.id!);
    await createJobRecord(older);
    const lane = laneKey(ctx.job.name, 'test-1');
    await claimLane(jobLaneStore, lane, older);
    const holdersDuringRun: (string | null)[] = [];
    const innerHandler = mock(async (handlerCtx: WorkerContext) => {
      holdersDuringRun.push(await handlerCtx.queue.redis.get(lane));
    });

    await makeSupersedingJob(innerHandler, (p: { value: number }) => `test-${p.value}`)(ctx, {
      value: 1,
    });

    expect(holdersDuringRun).toEqual([ctx.job.id!]);
    expect(await fetchSupersededBy(jobLaneStore, older)).toBe(ctx.job.id!);
  });

  test('a running job stops when a newer existing job takes its lane, and its record is marked', async () => {
    let signalAborted = false;
    let handlerFinished = false;
    const innerHandler = mock(async (handlerCtx: WorkerContext, _payload: { value: number }) => {
      handlerCtx.signal?.addEventListener('abort', () => {
        signalAborted = true;
      });
      await sleep(2000);
      handlerFinished = true;
    });
    const handlerPromise = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, {
      value: 1,
    });

    await sleep(100);
    const newer = Bun.randomUUIDv7();
    await createJobRecord(newer);
    await claimLane(jobLaneStore, laneKey(ctx.job.name, 'test-1'), newer);
    const startedAt = Date.now();
    await handlerPromise;

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(handlerFinished).toBe(false);
    expect(signalAborted).toBe(true);
    expect(await fetchSupersededBy(jobLaneStore, ctx.job.id!)).toBe(newer);
  });

  test('a running job keeps going while its lane names a job that never existed (a failed add)', async () => {
    let handlerFinished = false;
    const innerHandler = mock(async (_ctx: WorkerContext, _payload: { value: number }) => {
      await sleep(900);
      handlerFinished = true;
    });
    const handlerPromise = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, {
      value: 1,
    });

    await sleep(100);
    await claimLane(jobLaneStore, laneKey(ctx.job.name, 'test-1'), Bun.randomUUIDv7());
    await handlerPromise;

    expect(handlerFinished).toBe(true);
  });

  test('a running child stops when its parent is superseded, and passes the superseder to itself', async () => {
    const parentId = Bun.randomUUIDv7();
    const newerParent = Bun.randomUUIDv7();
    await createJobRecord(parentId);
    ctx.job.parent = { id: parentId, queueKey: 'bull:jobs' };
    let handlerFinished = false;
    const handlerPromise = makeSupersedingJob<Record<string, never>>(
      async () => {
        await sleep(2000);
        handlerFinished = true;
      },
      () => 'running-child-lane',
    )(ctx, {});

    await sleep(100);
    await markSuperseded(parentId, newerParent);
    const startedAt = Date.now();
    await handlerPromise;

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(handlerFinished).toBe(false);
    expect(await fetchSupersededBy(jobLaneStore, ctx.job.id!)).toBe(newerParent);
  });

  test('passes an unaborted signal to the handler', async () => {
    let receivedSignal: AbortSignal | undefined;
    const innerHandler = mock(async (handlerCtx: WorkerContext, _payload: { value: number }) => {
      receivedSignal = handlerCtx.signal;
    });

    await makeSupersedingJob(innerHandler, (p) => `test-${p.value}`)(ctx, { value: 1 });

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  test('attaches dedupeKeyFn to the handler', () => {
    const dedupeKeyFn = (p: { id: string }) => `dedupe-${p.id}`;
    const handler = makeSupersedingJob(
      mock(async () => {}),
      dedupeKeyFn,
    ) as SupersedingJobHandler<{ id: string }>;

    expect(handler.dedupeKeyFn).toBe(dedupeKeyFn);
    expect(handler.dedupeKeyFn?.({ id: 'abc' })).toBe('dedupe-abc');
  });

  test('propagates errors that are not supersession', async () => {
    const handler = makeSupersedingJob(
      mock(async () => {
        throw new Error('Test error');
      }),
      () => 'test-key',
    );

    await expect(handler(ctx)).rejects.toThrow('Test error');
  });
});

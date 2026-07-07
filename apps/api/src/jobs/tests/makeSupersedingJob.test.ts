import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { claimLane, laneKey } from '@template/db';
import { makeSupersedingJob, type SupersedingJobHandler } from '#/jobs/makeSupersedingJob';
import type { WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

describe('makeSupersedingJob', () => {
  let ctx: WorkerContext;

  beforeEach(() => {
    ctx = createTestWorker();
  });

  afterEach(async () => {
    const redis = ctx.queue.redis;
    const keys = [...(await redis.keys('lane:*')), ...(await redis.keys('superseded:*'))];
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  });

  test('should complete normally when not superseded', async () => {
    let result = 0;
    const innerHandler = mock(async (_ctx: WorkerContext, payload: { value: number }) => {
      result = payload.value * 2;
    });

    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    await handler(ctx, { value: 5 });

    expect(innerHandler).toHaveBeenCalledTimes(1);
    expect(result).toBe(10);
  });

  test('should abort when superseded during execution', async () => {
    let handlerStarted = false;
    let handlerFinished = false;

    const innerHandler = mock(async (_ctx: WorkerContext, _payload: { value: number }) => {
      handlerStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      handlerFinished = true;
    });

    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    const handlerPromise = handler(ctx, { value: 1 });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(handlerStarted).toBe(true);

    await claimLane(laneKey(ctx.job.name, 'test-1'), 'newer');

    const startTime = Date.now();
    await handlerPromise;
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(handlerFinished).toBe(false);
  });

  test('should pass signal to handler context', async () => {
    let receivedSignal: AbortSignal | undefined;

    const innerHandler = mock(async (handlerCtx: WorkerContext, _payload: { value: number }) => {
      receivedSignal = handlerCtx.signal;
    });

    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    await handler(ctx, { value: 1 });

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  test('should abort signal when superseded', async () => {
    let signalAborted = false;

    const innerHandler = mock(async (handlerCtx: WorkerContext, _payload: { value: number }) => {
      handlerCtx.signal?.addEventListener('abort', () => {
        signalAborted = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    const handlerPromise = handler(ctx, { value: 1 });

    await new Promise((resolve) => setTimeout(resolve, 100));
    await claimLane(laneKey(ctx.job.name, 'test-1'), 'newer');

    await handlerPromise;

    expect(signalAborted).toBe(true);
  });

  test('should not run when the job was displaced while queued (tombstoned before start)', async () => {
    const lane = laneKey(ctx.job.name, 'test-1');
    await claimLane(lane, ctx.job.id!);
    await claimLane(lane, 'newer'); // displaces this job → tombstone survives even if the lane expires

    const innerHandler = mock(async (_ctx: WorkerContext, _payload: { value: number }) => {});
    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    await handler(ctx, { value: 1 });

    expect(innerHandler).not.toHaveBeenCalled();
  });

  test('should re-assert a lapsed baton at start so the run is visible to lane reads', async () => {
    let holderDuringRun: string | null = null;
    const innerHandler = mock(async (handlerCtx: WorkerContext, payload: { value: number }) => {
      holderDuringRun = await handlerCtx.queue.redis.get(laneKey(handlerCtx.job.name, `test-${payload.value}`));
    });

    const handler = makeSupersedingJob(innerHandler, (p) => `test-${p.value}`);
    await handler(ctx, { value: 1 }); // no enqueue-time claim — the baton lapsed while queued

    expect(holderDuringRun).toBe(ctx.job.id!);
  });

  test('should attach dedupeKeyFn to handler', () => {
    const dedupeKeyFn = (p: { id: string }) => `dedupe-${p.id}`;
    const innerHandler = mock(async () => {});

    const handler = makeSupersedingJob(innerHandler, dedupeKeyFn) as SupersedingJobHandler<{ id: string }>;

    expect(handler.dedupeKeyFn).toBe(dedupeKeyFn);
    expect(handler.dedupeKeyFn?.({ id: 'abc' })).toBe('dedupe-abc');
  });

  test('should propagate non-supersession errors', async () => {
    const testError = new Error('Test error');

    const innerHandler = mock(async () => {
      throw testError;
    });

    const handler = makeSupersedingJob(innerHandler, () => 'test-key');

    await expect(handler(ctx, {})).rejects.toThrow('Test error');
  });
});

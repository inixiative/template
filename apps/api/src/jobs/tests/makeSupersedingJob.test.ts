import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createTestWorker } from '#tests/createTestWorker';
import { type SupersedingJobHandler, makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import type { WorkerContext } from '#/jobs/types';

describe('makeSupersedingJob', () => {
  let ctx: WorkerContext;

  beforeEach(() => {
    ctx = createTestWorker();
  });

  afterEach(async () => {
    const redis = ctx.queue.redis;
    const keys = await redis.keys('job:superseded:*');
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
    const redis = ctx.queue.redis;
    const jobId = ctx.job.id;
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

    await redis.set(`job:superseded:${jobId}`, '1', 'EX', 300);

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
    const redis = ctx.queue.redis;
    const jobId = ctx.job.id;
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
    await redis.set(`job:superseded:${jobId}`, '1', 'EX', 300);

    await handlerPromise;

    expect(signalAborted).toBe(true);
  });

  test('should clean up Redis key after completion', async () => {
    const redis = ctx.queue.redis;
    const jobId = ctx.job.id;
    const supersededKey = `job:superseded:${jobId}`;

    await redis.set(supersededKey, '1', 'EX', 300);

    const innerHandler = mock(async () => {});
    const handler = makeSupersedingJob(innerHandler, () => 'test-key');

    await handler(ctx, {});

    const keyExists = await redis.get(supersededKey);
    expect(keyExists).toBeNull();
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

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { redisNamespace } from '@template/db/redis/namespaces';
import { log } from '@template/shared/logger';
import { makeSingletonJob } from '#/jobs/makeSingletonJob';
import type { WorkerContext } from '#/jobs/types';
import { createTestWorker } from '#tests/createTestWorker';

const SINGLETON_ID = 'singleton-test';
const LOCK_KEY = `${redisNamespace.lock}:job-singleton:${SINGLETON_ID}`;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const singletonContext = (jobId: string): WorkerContext =>
  createTestWorker({ id: jobId, name: 'singleton-job', data: { id: SINGLETON_ID } });

describe('makeSingletonJob', () => {
  let ctx: WorkerContext;
  let errorSpy: ReturnType<typeof spyOn>;
  let warnSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    ctx = singletonContext('holder-job');
    errorSpy = spyOn(log, 'error').mockImplementation(() => {});
    warnSpy = spyOn(log, 'warn').mockImplementation(() => {});
    await ctx.queue.redis.del(LOCK_KEY);
  });

  afterEach(async () => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    await ctx.queue.redis.del(LOCK_KEY);
  });

  test('stores a per-run owner token on the queue connection and removes it on release', async () => {
    const started = deferred();
    const gate = deferred();
    const run = makeSingletonJob(async () => {
      started.resolve();
      await gate.promise;
    })(ctx);
    await started.promise;

    const token = await ctx.queue.redis.get(LOCK_KEY);
    expect(token).toHaveLength(36);
    expect(await ctx.queue.redis.pttl(LOCK_KEY)).toBeGreaterThan(0);

    gate.resolve();
    await run;
    expect(await ctx.queue.redis.get(LOCK_KEY)).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test('refuses a second acquirer while the token holder runs', async () => {
    const started = deferred();
    const gate = deferred();
    const firstRun = makeSingletonJob(async () => {
      started.resolve();
      await gate.promise;
    })(ctx);
    await started.promise;
    const token = await ctx.queue.redis.get(LOCK_KEY);

    const secondHandler = mock(async () => {});
    await makeSingletonJob(secondHandler)(singletonContext('second-job'));

    expect(secondHandler).not.toHaveBeenCalled();
    expect(await ctx.queue.redis.get(LOCK_KEY)).toBe(token);

    gate.resolve();
    await firstRun;
    expect(await ctx.queue.redis.get(LOCK_KEY)).toBeNull();
  });

  test('a run whose lock was taken over completes, is reported, and leaves the new holder alone', async () => {
    const started = deferred();
    const gate = deferred();
    const handler = mock(async () => {
      started.resolve();
      await gate.promise;
    });
    const run = makeSingletonJob(handler)(ctx);
    await started.promise;

    await ctx.queue.redis.set(LOCK_KEY, 'other-token', 'EX', 60);
    gate.resolve();
    await run;

    expect(handler).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('singletonJob.lockLost', {
      jobId: 'holder-job',
      identifier: SINGLETON_ID,
      reason: 'token_mismatch',
    });
    expect(errorSpy).toHaveBeenCalledWith('singletonJob.completedAfterLockLoss', {
      jobId: 'holder-job',
      identifier: SINGLETON_ID,
      durationMs: expect.any(Number),
      leaseHeldToRelease: false,
    });
    expect(await ctx.queue.redis.get(LOCK_KEY)).toBe('other-token');
  });

  test('reports failure after lock loss and propagates the handler rejection', async () => {
    const started = deferred();
    const gate = deferred();
    const handlerError = new Error('handler failed');
    const run = makeSingletonJob(async () => {
      started.resolve();
      await gate.promise;
      throw handlerError;
    })(ctx);
    await started.promise;

    await ctx.queue.redis.set(LOCK_KEY, 'other-token', 'EX', 60);
    gate.resolve();

    await expect(run).rejects.toBe(handlerError);
    expect(errorSpy).toHaveBeenCalledWith('singletonJob.failedAfterLockLoss', {
      jobId: 'holder-job',
      identifier: SINGLETON_ID,
      durationMs: expect.any(Number),
      leaseHeldToRelease: false,
    });
    expect(errorSpy).not.toHaveBeenCalledWith('singletonJob.completedAfterLockLoss', expect.anything());
  });

  test('warns without reporting lock loss when the release cannot be confirmed', async () => {
    const backingRedis = ctx.queue.redis;
    let hasThrown = false;
    const flakyRedis = Object.assign(Object.create(backingRedis), {
      eval: async (...args: unknown[]) => {
        if (args.length === 4 && !hasThrown) {
          hasThrown = true;
          throw new Error('release unavailable');
        }
        return Reflect.apply(backingRedis.eval, backingRedis, args);
      },
    }) as typeof backingRedis;
    const injectedCtx = {
      ...ctx,
      queue: Object.assign(Object.create(ctx.queue), { redis: flakyRedis }),
    } as WorkerContext;

    await makeSingletonJob(async () => {})(injectedCtx);

    expect(warnSpy).toHaveBeenCalledWith('singletonJob.releaseUnconfirmed', {
      jobId: 'holder-job',
      identifier: SINGLETON_ID,
      message: 'The key is freed if the delete still reaches Redis, otherwise at its TTL',
    });
    expect(errorSpy).not.toHaveBeenCalledWith('singletonJob.lockLost', expect.anything());
    expect(await backingRedis.get(LOCK_KEY)).toHaveLength(36);
  });
});

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { createLock } from '@template/db/lock/createLock';
import { LockLostError } from '@template/db/lock/lockLostError';
import { maxSafeHeartbeatMs } from '@template/db/lock/maxSafeHeartbeatMs';
import type { LockRedis } from '@template/db/lock/types';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const newId = () => `test-${Bun.randomUUIDv7()}`;
const keyFor = (id: string) => `${redisNamespace.lock}:s:${id}`;
const fastOpts = { ttlMs: 100, heartbeatMs: 30 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 500,
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await sleep(5);
  }
  throw new Error('Timed out waiting for condition');
};

// A refresh eval carries 5 args (script, numkeys, key, token, ttl); a delete eval carries 4.
const isRefresh = (args: unknown[]) => args.length === 5;
const stubRedis = (eval_: (...args: unknown[]) => Promise<unknown>): LockRedis =>
  ({ set: async () => 'OK', get: async () => null, eval: eval_ }) as unknown as LockRedis;

describe('createLock', () => {
  describe('construction validation', () => {
    it('throws when heartbeatMs <= 0', () => {
      expect(() => createLock({ service: 's', identifier: newId(), heartbeatMs: 0 })).toThrow(
        'heartbeatMs must be > 0',
      );
    });

    it('throws when 2 * heartbeatMs >= ttlMs', () => {
      expect(() =>
        createLock({ service: 's', identifier: newId(), ttlMs: 100, heartbeatMs: 50 }),
      ).toThrow('unsafe config');
    });

    it('accepts safe defaults', () => {
      const lock = createLock({ service: 's', identifier: newId() });
      expect(lock).toBeDefined();
    });
  });

  describe('maxSafeHeartbeatMs', () => {
    it('is the timeout-aware ceiling and passes the constructor', () => {
      expect(maxSafeHeartbeatMs({ ttlMs: 300_000, commandTimeoutMs: 5_000 })).toBe(142_499);
      expect(maxSafeHeartbeatMs({ ttlMs: 30_000 })).toBe(7_499);
      expect(() => maxSafeHeartbeatMs({ ttlMs: 10_000, commandTimeoutMs: 5_000 })).toThrow(
        'createLock: ttlMs 10000 leaves no room for a heartbeat with a 5000 ms command timeout',
      );
      expect(() =>
        createLock({
          service: 's',
          identifier: newId(),
          ttlMs: 300_000,
          heartbeatMs: maxSafeHeartbeatMs({ ttlMs: 300_000, commandTimeoutMs: 5_000 }),
        }),
      ).not.toThrow();
    });
  });

  describe('acquire', () => {
    it('returns true when free, false when held', async () => {
      const id = newId();
      const a = createLock({ service: 's', identifier: id, ...fastOpts });
      const b = createLock({ service: 's', identifier: id, ...fastOpts });

      expect(await a.acquire()).toBe(true);
      expect(await b.acquire()).toBe(false);
      await a.release();
    });

    it('two concurrent acquires — only one succeeds', async () => {
      const id = newId();
      const a = createLock({ service: 's', identifier: id, ...fastOpts });
      const b = createLock({ service: 's', identifier: id, ...fastOpts });

      const [aHeld, bHeld] = await Promise.all([a.acquire(), b.acquire()]);
      expect([aHeld, bHeld].sort()).toEqual([false, true]);
      await a.release();
      await b.release();
    });

    it('uses an injected connection and an exact custom key', async () => {
      const calls = { set: [] as unknown[][], get: [] as unknown[][], eval: [] as unknown[][] };
      let token = '';
      const redis = {
        set: async (...args: unknown[]) => {
          calls.set.push(args);
          token = String(args[1]);
          return 'OK';
        },
        get: async (...args: unknown[]) => {
          calls.get.push(args);
          return token;
        },
        eval: async (...args: unknown[]) => {
          calls.eval.push(args);
          return 1;
        },
      } as unknown as LockRedis;
      const lock = createLock({
        key: 'lock:exact-custom-key',
        redis,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });

      expect(await lock.acquire()).toBe(true);
      expect(await lock.verify()).toBe(true);
      expect(await lock.release()).toBe('released');
      expect(calls.set[0]).toEqual(['lock:exact-custom-key', token, 'PX', 60_000, 'NX']);
      expect(calls.get[0]).toEqual(['lock:exact-custom-key']);
      expect(calls.eval[0]?.slice(1)).toEqual([1, 'lock:exact-custom-key', token]);
    });

    it('with waitMs queues behind the holder and wins once it releases', async () => {
      const id = newId();
      const holder = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      const waiter = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      expect(await holder.acquire()).toBe(true);

      const acquiring = waiter.acquire({ waitMs: 1_000, pollMs: 10 });
      await sleep(60);
      expect(await waiter.verify()).toBe(false);
      await holder.release();

      expect(await acquiring).toBe(true);
      expect(await waiter.verify()).toBe(true);
      await waiter.release();
    });

    it('takes over a briefly held lock well inside its slowest poll', async () => {
      const id = newId();
      const holder = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      const waiter = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      expect(await holder.acquire()).toBe(true);

      const pollMs = 500;
      const acquiring = waiter.acquire({ waitMs: 2_000, pollMs });
      await sleep(5);
      const releasedAt = Date.now();
      await holder.release();

      expect(await acquiring).toBe(true);
      expect(Date.now() - releasedAt).toBeLessThan(pollMs / 2);
      await waiter.release();
    });

    it('with waitMs returns false once the wait runs out', async () => {
      const id = newId();
      const holder = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      const waiter = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      expect(await holder.acquire()).toBe(true);

      const startedAt = Date.now();
      expect(await waiter.acquire({ waitMs: 80, pollMs: 10 })).toBe(false);
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(80);

      expect(await holder.verify()).toBe(true);
      await holder.release();
    });

    it('throws the onTimeout error instead of returning false', async () => {
      const id = newId();
      const holder = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      const waiter = createLock({
        service: 's',
        identifier: id,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });
      expect(await holder.acquire()).toBe(true);

      await expect(
        waiter.acquire({ waitMs: 40, pollMs: 10, onTimeout: () => new Error('still held') }),
      ).rejects.toThrow('still held');

      await holder.release();
    });
  });

  describe('verify', () => {
    it('returns true while held', async () => {
      const lock = createLock({ service: 's', identifier: newId(), ...fastOpts });
      await lock.acquire();
      expect(await lock.verify()).toBe(true);
      await lock.release();
    });

    it('returns false after key taken over externally', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await getRedisClient().set(keyFor(id), 'someone-else');
      expect(await lock.verify()).toBe(false);
      await lock.release();
    });
  });

  describe('isWithinLease', () => {
    it('is false before acquire and after release', async () => {
      const lock = createLock({ service: 's', identifier: newId(), ...fastOpts });
      expect(lock.isWithinLease()).toBe(false);
      await lock.acquire();
      expect(lock.isWithinLease()).toBe(true);
      await lock.release();
      expect(lock.isWithinLease()).toBe(false);
    });

    it('stays true past ttlMs while refreshes succeed', async () => {
      const lock = createLock({
        key: 'lock:test:lease-renewed',
        redis: stubRedis(async () => 1),
        ...fastOpts,
      });
      await lock.acquire();
      await sleep(fastOpts.ttlMs + 50);
      expect(lock.isWithinLease()).toBe(true);
      await lock.release();
    });

    it('lapses when refreshes fail and stays lapsed after one succeeds again', async () => {
      let mayRefresh = false;
      let refreshes = 0;
      const lock = createLock({
        key: 'lock:test:lease-lapsed',
        redis: stubRedis(async (...args) => {
          if (!isRefresh(args)) return 1;
          refreshes++;
          if (!mayRefresh) throw new Error('refresh unavailable');
          return 1;
        }),
        ttlMs: 300,
        heartbeatMs: 100,
      });
      await lock.acquire();
      await sleep(350);
      expect(lock.isWithinLease()).toBe(false);
      mayRefresh = true;
      const failed = refreshes;
      await waitFor(() => refreshes > failed);
      expect(lock.isWithinLease()).toBe(false);
      await lock.release();
    });

    it('times the lease from when the SET was sent, not when it replied', async () => {
      let replySet = (): void => {};
      const pending = new Promise<void>((resolve) => {
        replySet = resolve;
      });
      const redis = {
        set: async () => {
          await pending;
          return 'OK';
        },
        get: async () => null,
        eval: async () => 1,
      } as unknown as LockRedis;
      const lock = createLock({
        key: 'lock:test:lease-late-set',
        redis,
        ttlMs: 300,
        heartbeatMs: 100,
      });
      const acquiring = lock.acquire();
      await sleep(350);
      replySet();
      expect(await acquiring).toBe(true);
      expect(lock.isWithinLease()).toBe(false);
      await lock.release();
    });
  });

  describe('assertHeld', () => {
    it('passes while the lease holds and throws LockLostError once it is gone', async () => {
      const lock = createLock({ service: 's', identifier: newId(), ...fastOpts });
      expect(() => lock.assertHeld()).toThrow(LockLostError);
      await lock.acquire();
      expect(() => lock.assertHeld()).not.toThrow();
      await lock.release();
      expect(() => lock.assertHeld()).toThrow(LockLostError);
    });
  });

  describe('release', () => {
    it('deletes the key when held and reports released', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      expect(await lock.release()).toBe('released');
      expect(await getRedisClient().get(keyFor(id))).toBeNull();
    });

    it('is fenced: preserves a new holder and reports notHeld', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await getRedisClient().set(keyFor(id), 'someone-else');
      expect(await lock.release()).toBe('notHeld');
      expect(await getRedisClient().get(keyFor(id))).toBe('someone-else');
    });

    it('without acquire is a safe no-op', async () => {
      const lock = createLock({ service: 's', identifier: newId(), ...fastOpts });
      await expect(lock.release()).resolves.toBe('notHeld');
    });

    it('is unconfirmed when the fenced delete throws', async () => {
      const redis = stubRedis(async () => {
        throw new Error('delete unavailable');
      });
      const lock = createLock({
        key: 'lock:test:release-unconfirmed',
        redis,
        ttlMs: 60_000,
        heartbeatMs: 10_000,
      });

      expect(await lock.acquire()).toBe(true);
      await expect(lock.release()).resolves.toBe('unconfirmed');
    });
  });

  describe('heartbeat', () => {
    it('keeps lock alive past ttlMs while held', async () => {
      const lock = createLock({ service: 's', identifier: newId(), ...fastOpts });
      await lock.acquire();
      await sleep(fastOpts.ttlMs + 50);
      expect(await lock.verify()).toBe(true);
      await lock.release();
    });

    it('refreshes with one fenced eval, never a separate get', async () => {
      const calls = { get: [] as unknown[][], eval: [] as unknown[][] };
      let token = '';
      const redis = {
        set: async (...args: unknown[]) => {
          token = String(args[1]);
          return 'OK';
        },
        get: async (...args: unknown[]) => {
          calls.get.push(args);
          return token;
        },
        eval: async (...args: unknown[]) => {
          calls.eval.push(args);
          return 1;
        },
      } as unknown as LockRedis;
      const key = 'lock:test:atomic-refresh';
      const lock = createLock({ key, redis, ttlMs: 1_000, heartbeatMs: 20 });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => calls.eval.some(isRefresh));
      await expect(lock.release()).resolves.toBe('released');

      const refresh = calls.eval.find(isRefresh);
      expect(calls.get).toHaveLength(0);
      expect(String(refresh?.[0])).toContain('pexpire');
      expect(refresh?.slice(1)).toEqual([1, key, token, '1000']);
    });

    it('declares a stolen lock lost on the first tick without extending the new holder', async () => {
      const id = newId();
      const redis = getRedisClient();
      let lostCount = 0;
      const lock = createLock({
        service: 's',
        identifier: id,
        ttlMs: 2_000,
        heartbeatMs: 25,
        onLockLost: () => {
          lostCount += 1;
        },
      });

      expect(await lock.acquire()).toBe(true);
      await redis.set(keyFor(id), 'new-holder', 'PX', 1_000);
      const foreignTtl = await redis.pttl(keyFor(id));

      await waitFor(() => lostCount === 1, 250);
      expect(await lock.verify()).toBe(false);
      expect(await redis.get(keyFor(id))).toBe('new-holder');
      expect(await redis.pttl(keyFor(id))).toBeLessThanOrEqual(foreignTtl);

      await redis.del(keyFor(id));
      expect(await lock.release()).toBe('notHeld');
    });

    it('verify answers from Redis after an observed loss: a key holding our token again reads true', async () => {
      const id = newId();
      const redis = getRedisClient();
      let lostCount = 0;
      const lock = createLock({
        service: 's',
        identifier: id,
        ttlMs: 2_000,
        heartbeatMs: 25,
        onLockLost: () => {
          lostCount += 1;
        },
      });

      expect(await lock.acquire()).toBe(true);
      await redis.set(keyFor(id), 'new-holder', 'PX', 1_000);
      await waitFor(() => lostCount === 1, 250);
      expect(await lock.verify()).toBe(false);

      await redis.set(keyFor(id), lock.holder, 'PX', 1_000);
      expect(await lock.verify()).toBe(true);
      expect(lock.isWithinLease()).toBe(false);
      expect(await lock.release()).toBe('released');
      expect(await lock.verify()).toBe(false);
    });

    it('does not fire onLockLost while heartbeats succeed', async () => {
      let lostCount = 0;
      const lock = createLock({
        service: 's',
        identifier: newId(),
        ...fastOpts,
        onLockLost: () => {
          lostCount += 1;
        },
      });
      await lock.acquire();
      await sleep(fastOpts.heartbeatMs * 4 + 10);
      expect(lostCount).toBe(0);
      await lock.release();
    });

    it('refresh errors never fire onLockLost, keep refreshing and never delete before release', async () => {
      let refreshAttempts = 0;
      let lostCount = 0;
      const deleteEvals: unknown[][] = [];
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) {
          deleteEvals.push(args);
          return 1;
        }
        refreshAttempts += 1;
        throw new Error('refresh unavailable');
      });
      const lock = createLock({
        key: 'lock:test:refresh-errors',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        onLockLost: () => {
          lostCount += 1;
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts >= 4);
      expect(lostCount).toBe(0);
      expect(deleteEvals).toHaveLength(0);

      await expect(lock.release()).resolves.toBe('released');
      expect(deleteEvals).toHaveLength(1);
    });

    it('verify follows Redis ownership once refresh errors recover', async () => {
      let refreshAttempts = 0;
      let token = '';
      const redis = {
        set: async (...args: unknown[]) => {
          token = String(args[1]);
          return 'OK';
        },
        get: async () => token,
        eval: async (...args: unknown[]) => {
          if (!isRefresh(args)) return 1;
          refreshAttempts += 1;
          if (refreshAttempts <= 2) throw new Error('refresh unavailable');
          return 1;
        },
      } as unknown as LockRedis;
      const lock = createLock({ key: 'lock:test:recovered', redis, ttlMs: 1_000, heartbeatMs: 10 });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts >= 3);
      expect(await lock.verify()).toBe(true);
      await expect(lock.release()).resolves.toBe('released');
    });

    it('a throwing onLockLost callback does not reject the beat', async () => {
      let refreshAttempts = 0;
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) return 1;
        refreshAttempts += 1;
        return 0;
      });
      const lock = createLock({
        key: 'lock:test:throwing-loss-callback',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        onLockLost: () => {
          throw new Error('callback failed');
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts === 1);
      await sleep(50);
      expect(refreshAttempts).toBe(1);
      await lock.release();
    });

    it('stops on release', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await lock.release();
      await sleep(fastOpts.ttlMs + 50);
      expect(await getRedisClient().get(keyFor(id))).toBeNull();
    });
  });
  describe('release', () => {
    it('a released lock cannot acquire again', async () => {
      const lock = createLock({ service: 's', identifier: newId() });

      expect(await lock.acquire()).toBe(true);
      expect(await lock.release()).toBe('released');
      await expect(lock.acquire()).rejects.toThrow(/released.*new lock/i);
    });

    it('a release during a pending SET deletes the key that SET wrote and never starts a heartbeat', async () => {
      let finishSet: () => void = () => {};
      const setPending = new Promise<void>((resolve) => {
        finishSet = resolve;
      });
      let currentToken: string | null = null;
      const evalCalls: unknown[][] = [];
      const redis = {
        set: async (...args: unknown[]) => {
          await setPending;
          currentToken = String(args[1]);
          return 'OK';
        },
        get: async () => currentToken,
        eval: async (...args: unknown[]) => {
          evalCalls.push(args);
          if (currentToken !== args[3]) return 0;
          currentToken = null;
          return 1;
        },
      } as unknown as LockRedis;
      const lock = createLock({
        key: `lock:test:${newId()}`,
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
      });

      const acquiring = lock.acquire();
      expect(await lock.release()).toBe('notHeld');
      finishSet();
      expect(await acquiring).toBe(false);
      expect(currentToken).toBeNull();
      await sleep(40);
      expect(evalCalls.filter(isRefresh)).toHaveLength(0);
    });

    it('a repeated release shares the first result and sends one fenced delete', async () => {
      let deletes = 0;
      const lock = createLock({
        key: `lock:test:${newId()}`,
        redis: stubRedis(async () => {
          deletes += 1;
          return 1;
        }),
      });

      expect(await lock.acquire()).toBe(true);
      const first = lock.release();
      const second = lock.release();
      expect(second).toBe(first);
      expect(await second).toBe('released');
      expect(await lock.release()).toBe('released');
      expect(deletes).toBe(1);
    });

    it('a second release never deletes the key of the holder that took it after the first', async () => {
      const identifier = newId();
      const first = createLock({ service: 's', identifier });
      expect(await first.acquire()).toBe(true);
      expect(await first.release()).toBe('released');

      const successor = createLock({ service: 's', identifier });
      expect(await successor.acquire()).toBe(true);
      expect(await first.release()).toBe('released');
      expect(await getRedisClient().exists(keyFor(identifier))).toBe(1);
      await successor.release();
    });
  });
  describe('a lock on several identifiers', () => {
    const run = newId();
    const redis = getRedisClient();
    const id = (name: string) => `${run}-${name}`;
    const key = (name: string) => keyFor(id(name));
    const opts = (name: string) => ({
      service: 's',
      identifier: id(name),
      ttlMs: 60_000,
      heartbeatMs: 10_000,
    });
    const batch = (
      names: string[],
      overrides: Partial<{ ttlMs: number; heartbeatMs: number }> = {},
    ) =>
      createLock({
        service: 's',
        identifiers: names.map(id),
        ttlMs: 60_000,
        heartbeatMs: 10_000,
        ...overrides,
      });

    afterEach(async () => {
      const keys = await redis.keys(`${keyFor(run)}*`);
      if (keys.length) await redis.del(...keys);
    });

    it('takes every key under one token, and each key is the one a single-identifier lock takes', async () => {
      const lock = batch(['m1', 'm2', 'm3']);

      expect(await lock.acquire()).toBe(true);
      const tokens = await Promise.all(['m1', 'm2', 'm3'].map((name) => redis.get(key(name))));
      expect(new Set(tokens).size).toBe(1);
      expect(await createLock(opts('m2')).acquire()).toBe(false);

      expect(await lock.release()).toBe('released');
      expect(await Promise.all(['m1', 'm2', 'm3'].map((name) => redis.exists(key(name))))).toEqual([
        0, 0, 0,
      ]);
    });

    it('an acquire that does not get every key ends holding none of them', async () => {
      const holder = createLock(opts('n2'));
      expect(await holder.acquire()).toBe(true);

      expect(await batch(['n1', 'n2', 'n3']).acquire()).toBe(false);
      expect(await redis.exists(key('n1'))).toBe(0);
      expect(await redis.exists(key('n3'))).toBe(0);

      await holder.release();
      const lock = batch(['n1', 'n2', 'n3']);
      expect(await lock.acquire()).toBe(true);
      await lock.release();
    });

    it('heartbeat refreshes every key in one eval', async () => {
      const lock = batch(['h1', 'h2', 'h3'], { ttlMs: 200, heartbeatMs: 25 });
      expect(await lock.acquire()).toBe(true);
      const evalScript = spyOn(redis, 'eval');
      try {
        await waitFor(() => evalScript.mock.calls.length > 0, 250);
        expect(evalScript.mock.calls[0]?.[1]).toBe(3);
        await sleep(300);
        expect(await lock.verify()).toBe(true);
      } finally {
        evalScript.mockRestore();
      }
      expect(await lock.release()).toBe('released');
    });

    const lostCounter = () => {
      const counter = { lost: 0 };
      return {
        counter,
        onLockLost: () => {
          counter.lost++;
        },
      };
    };
    const outlive = (ms: number) => {
      const until = Date.now() + ms;
      return waitFor(() => Date.now() >= until, ms + 5_000);
    };

    it('a key taken over by another holder is dropped from the set, and the rest stay held', async () => {
      const { counter, onLockLost } = lostCounter();
      const lock = createLock({
        service: 's',
        identifiers: [id('l1'), id('l2')],
        ttlMs: 200,
        heartbeatMs: 25,
        onLockLost,
      });
      expect(await lock.acquire()).toBe(true);
      const token = await redis.get(key('l1'));
      await redis.set(key('l2'), 'new-holder', 'PX', 60_000);
      const foreignTtl = await redis.pttl(key('l2'));

      await waitFor(() => counter.lost === 1, 1_000);
      await outlive(400);

      expect(counter.lost).toBe(1);
      expect(await lock.verify()).toBe(false);
      expect(await redis.get(key('l1'))).toBe(token);
      expect(await redis.pttl(key('l2'))).toBeLessThanOrEqual(foreignTtl);
      expect(await lock.release()).toBe('notHeld');
      expect(await redis.exists(key('l1'))).toBe(0);
      expect(await redis.get(key('l2'))).toBe('new-holder');
    });

    it('an evicted key un-protects only itself: the rest are kept alive past their TTL', async () => {
      const { counter, onLockLost } = lostCounter();
      const lock = createLock({
        service: 's',
        identifiers: [id('e1'), id('e2'), id('e3')],
        ttlMs: 200,
        heartbeatMs: 25,
        onLockLost,
      });
      expect(await lock.acquire()).toBe(true);
      const token = await redis.get(key('e1'));
      await redis.del(key('e2'));

      await waitFor(() => counter.lost === 1, 1_000);
      await outlive(400);

      expect(await redis.get(key('e1'))).toBe(token);
      expect(await redis.get(key('e3'))).toBe(token);
      expect(await redis.exists(key('e2'))).toBe(0);
      expect(await lock.release()).toBe('notHeld');
      expect(await redis.exists(key('e1'))).toBe(0);
      expect(await redis.exists(key('e3'))).toBe(0);
    });

    it('losing every key reports the loss once and stops the heartbeat', async () => {
      const { counter, onLockLost } = lostCounter();
      const lock = createLock({
        service: 's',
        identifiers: [id('gone-1'), id('gone-2')],
        ttlMs: 200,
        heartbeatMs: 25,
        onLockLost,
      });
      expect(await lock.acquire()).toBe(true);
      await redis.del(key('gone-1'), key('gone-2'));
      const evalScript = spyOn(redis, 'eval');

      try {
        await waitFor(() => counter.lost === 1, 1_000);
        const beatsAtLoss = evalScript.mock.calls.length;
        await outlive(200);
        expect(evalScript.mock.calls.length).toBe(beatsAtLoss);
      } finally {
        evalScript.mockRestore();
      }
      expect(await lock.verify()).toBe(false);
      expect(await lock.release()).toBe('notHeld');
    });

    it('makes progress under churn: keys that each free up are taken even if never all free at once', async () => {
      const names = Array.from({ length: 20 }, (_, n) => `churn-${String(n).padStart(2, '0')}`);
      const lanes = [0, 1, 2, 3].map((lane) => names.filter((_, n) => n % 4 === lane));
      let isChurning = true;
      const churn = async (lane: string[]) => {
        let step = 0;
        let current = createLock(opts(lane[0] as string));
        await current.acquire();
        while (isChurning) {
          await sleep(20);
          step += 1;
          const next = createLock(opts(lane[step % lane.length] as string));
          const isNextHeld = await next.acquire();
          await current.release();
          if (isNextHeld) current = next;
          else current = createLock(opts(lane[step % lane.length] as string));
        }
        await current.release();
      };
      const churners = lanes.map(churn);
      const lock = batch(names);

      try {
        expect(await lock.acquire({ waitMs: 10_000 })).toBe(true);
        expect(await lock.verify()).toBe(true);
      } finally {
        isChurning = false;
        await lock.release();
        await Promise.all(churners);
      }
    }, 20_000);

    it('two overlapping sets acquired at once both finish: one waits for the other', async () => {
      const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
      const first = batch(letters.slice(0, 13).map((letter) => `overlap-${letter}`));
      const second = batch(letters.slice(7).map((letter) => `overlap-${letter}`));
      const holdBriefly = async (lock: ReturnType<typeof batch>) => {
        const isAcquired = await lock.acquire({ waitMs: 10_000 });
        await sleep(30);
        await lock.release();
        return isAcquired;
      };

      expect(await Promise.all([holdBriefly(first), holdBriefly(second)])).toEqual([true, true]);
    }, 20_000);

    it('keeps the keys it has won alive while it waits on a held one', async () => {
      const holder = createLock(opts('wait-2'));
      expect(await holder.acquire()).toBe(true);
      const lock = batch(['wait-1', 'wait-2', 'wait-3'], { ttlMs: 200, heartbeatMs: 25 });

      const acquiring = lock.acquire({ waitMs: 10_000 });
      await waitFor(async () => (await redis.get(key('wait-1'))) !== null, 2_000);
      const token = await redis.get(key('wait-1'));
      await outlive(400);

      expect(await redis.get(key('wait-1'))).toBe(token);
      expect(await redis.exists(key('wait-3'))).toBe(0);
      await holder.release();
      expect(await acquiring).toBe(true);
      expect(await redis.get(key('wait-1'))).toBe(token);
      expect(await redis.get(key('wait-2'))).toBe(token);
      expect(await redis.get(key('wait-3'))).toBe(token);
      expect(await lock.release()).toBe('released');
    }, 20_000);

    it('a key won and then lost while waiting on another restarts the acquire from the first key', async () => {
      const holder = createLock(opts('restart-2'));
      expect(await holder.acquire()).toBe(true);
      const { counter, onLockLost } = lostCounter();
      const lock = createLock({
        service: 's',
        identifiers: [id('restart-1'), id('restart-2'), id('restart-3')],
        ttlMs: 200,
        heartbeatMs: 25,
        onLockLost,
      });

      const acquiring = lock.acquire({ waitMs: 10_000 });
      await waitFor(async () => (await redis.get(key('restart-1'))) !== null, 2_000);
      await redis.del(key('restart-1'));
      await waitFor(() => counter.lost === 1, 1_000);
      await holder.release();

      expect(await acquiring).toBe(true);
      expect(await lock.verify()).toBe(true);
      await redis.del(key('restart-3'));
      await waitFor(() => counter.lost === 2, 1_000);
      expect(await lock.release()).toBe('notHeld');
    }, 20_000);

    it('release is fenced per key and reports notHeld unless it removed every key', async () => {
      const lock = batch(['r1', 'r2']);
      expect(await lock.acquire()).toBe(true);
      await redis.set(key('r2'), 'other-holder');

      expect(await lock.release()).toBe('notHeld');
      expect(await redis.exists(key('r1'))).toBe(0);
      expect(await redis.get(key('r2'))).toBe('other-holder');
    });

    it('rejects an empty identifier list', () => {
      expect(() => batch([])).toThrow('identifiers must name at least one key');
    });
  });
});

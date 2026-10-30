import { describe, expect, it } from 'bun:test';
import { createLock } from '@template/db/lock/createLock';
import { LockLostError } from '@template/db/lock/lockLostError';
import { maxSafeHeartbeatMs } from '@template/db/lock/maxSafeHeartbeatMs';
import type { LockRedis } from '@template/db/lock/types';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const newId = () => `test-${crypto.randomUUID()}`;
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
});

import { describe, expect, it } from 'bun:test';
import { createLock, type LockRedis, maxSafeHeartbeatMs } from '@template/db/lock/createLock';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const newId = () => `test-${crypto.randomUUID()}`;
const keyFor = (id: string) => `${redisNamespace.lock}:s:${id}`;
const fastOpts = { ttlMs: 100, heartbeatMs: 30, maxMissed: 1 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const waitFor = async (condition: () => boolean | Promise<boolean>, timeoutMs = 500): Promise<void> => {
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
    it('throws when maxMissed < 1', () => {
      expect(() => createLock({ service: 's', identifier: newId(), maxMissed: 0 })).toThrow('maxMissed must be >= 1');
    });

    it('throws when heartbeatMs <= 0', () => {
      expect(() => createLock({ service: 's', identifier: newId(), heartbeatMs: 0 })).toThrow(
        'heartbeatMs must be > 0',
      );
    });

    it('throws when (maxMissed + 1) * heartbeatMs >= ttlMs', () => {
      expect(() =>
        createLock({ service: 's', identifier: newId(), ttlMs: 100, heartbeatMs: 50, maxMissed: 1 }),
      ).toThrow('unsafe config');
    });

    it('accepts safe defaults', () => {
      const lock = createLock({ service: 's', identifier: newId() });
      expect(lock).toBeDefined();
    });
  });

  describe('maxSafeHeartbeatMs', () => {
    it('is the timeout-aware ceiling and passes the constructor', () => {
      expect(maxSafeHeartbeatMs({ ttlMs: 300_000, maxMissed: 1, commandTimeoutMs: 5_000 })).toBe(142_499);
      expect(maxSafeHeartbeatMs({ ttlMs: 300_000, maxMissed: 2, commandTimeoutMs: 5_000 })).toBe(93_333);
      expect(() => maxSafeHeartbeatMs({ ttlMs: 10_000, commandTimeoutMs: 5_000 })).toThrow(
        'createLock: ttlMs 10000 leaves no room for a heartbeat with a 5000 ms command timeout',
      );
      expect(() =>
        createLock({
          service: 's',
          identifier: newId(),
          ttlMs: 300_000,
          heartbeatMs: maxSafeHeartbeatMs({ ttlMs: 300_000, maxMissed: 1, commandTimeoutMs: 5_000 }),
          maxMissed: 1,
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
      const lock = createLock({ key: 'lock:exact-custom-key', redis, ttlMs: 60_000, heartbeatMs: 10_000 });

      expect(await lock.acquire()).toBe(true);
      expect(await lock.verify()).toBe(true);
      expect(await lock.release()).toBe('released');
      expect(calls.set[0]).toEqual(['lock:exact-custom-key', token, 'PX', 60_000, 'NX']);
      expect(calls.get[0]).toEqual(['lock:exact-custom-key']);
      expect(calls.eval[0]?.slice(1)).toEqual([1, 'lock:exact-custom-key', token]);
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
      const lock = createLock({ key: 'lock:test:release-unconfirmed', redis, ttlMs: 60_000, heartbeatMs: 10_000 });

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
      let lostReason: unknown;
      const lock = createLock({
        service: 's',
        identifier: id,
        ttlMs: 2_000,
        heartbeatMs: 25,
        maxMissed: 20,
        onLockLost: (reason) => {
          lostReason = reason;
        },
      });

      expect(await lock.acquire()).toBe(true);
      await redis.set(keyFor(id), 'new-holder', 'PX', 1_000);
      const foreignTtl = await redis.pttl(keyFor(id));

      // The missed-beat budget would take 525 ms here; a token mismatch bypasses it.
      await waitFor(() => lostReason !== undefined, 250);
      expect(lostReason).toBe('token_mismatch');
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

    it('resets the missed-beat budget on a successful refresh', async () => {
      let refreshAttempts = 0;
      const lostReasons: unknown[] = [];
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) return 1;
        refreshAttempts += 1;
        if (refreshAttempts % 2 === 1) throw new Error('intermittent refresh failure');
        return 1;
      });
      const lock = createLock({
        key: 'lock:test:intermittent-refresh',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        maxMissed: 1,
        onLockLost: (reason) => {
          lostReasons.push(reason);
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts >= 6);
      expect(lostReasons).toHaveLength(0);
      await expect(lock.release()).resolves.toBe('released');
    });

    it('spent refresh budget declares loss but keeps refreshing and never deletes before release', async () => {
      let refreshAttempts = 0;
      const lostReasons: unknown[] = [];
      const deleteEvals: unknown[][] = [];
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) {
          deleteEvals.push(args);
          return 1;
        }
        refreshAttempts += 1;
        if (refreshAttempts <= 2) throw new Error('refresh unavailable');
        return 1;
      });
      const lock = createLock({
        key: 'lock:test:error-budget',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        maxMissed: 1,
        onLockLost: (reason) => {
          lostReasons.push(reason);
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => lostReasons.length === 1);
      await waitFor(() => refreshAttempts >= 4);
      expect(lostReasons).toEqual(['refresh_errors']);
      expect(deleteEvals).toHaveLength(0);
      expect(await lock.verify()).toBe(false);

      await expect(lock.release()).resolves.toBe('released');
      expect(deleteEvals).toHaveLength(1);
    });

    it('keeps refreshing while an async onLockLost callback is pending', async () => {
      let refreshAttempts = 0;
      let resolveCallback: () => void = () => {};
      const callback = new Promise<void>((resolve) => {
        resolveCallback = resolve;
      });
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) return 1;
        refreshAttempts += 1;
        if (refreshAttempts <= 2) throw new Error('refresh unavailable');
        return 1;
      });
      const lock = createLock({
        key: 'lock:test:pending-loss-callback',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        maxMissed: 1,
        onLockLost: () => callback,
      });

      expect(await lock.acquire()).toBe(true);
      try {
        await waitFor(() => refreshAttempts >= 4);
      } finally {
        resolveCallback();
      }
      await expect(lock.release()).resolves.toBe('released');
    });

    it('a throwing onLockLost callback does not reject the beat', async () => {
      let refreshAttempts = 0;
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) return 1;
        refreshAttempts += 1;
        if (refreshAttempts <= 2) throw new Error('refresh unavailable');
        return 1;
      });
      const lock = createLock({
        key: 'lock:test:throwing-loss-callback',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        maxMissed: 1,
        onLockLost: () => {
          throw new Error('callback failed');
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts >= 4);
      await expect(lock.release()).resolves.toBe('released');
    });

    it('a token mismatch after a spent budget stops the heartbeat', async () => {
      let refreshAttempts = 0;
      const lostReasons: unknown[] = [];
      const redis = stubRedis(async (...args) => {
        if (!isRefresh(args)) return 0;
        refreshAttempts += 1;
        if (refreshAttempts <= 2) throw new Error('refresh unavailable');
        return 0;
      });
      const lock = createLock({
        key: 'lock:test:error-budget-then-mismatch',
        redis,
        ttlMs: 1_000,
        heartbeatMs: 10,
        maxMissed: 1,
        onLockLost: (reason) => {
          lostReasons.push(reason);
        },
      });

      expect(await lock.acquire()).toBe(true);
      await waitFor(() => refreshAttempts === 3);
      await sleep(100);

      expect(refreshAttempts).toBe(3);
      expect(lostReasons).toEqual(['refresh_errors']);
      await expect(lock.release()).resolves.toBe('notHeld');
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
});

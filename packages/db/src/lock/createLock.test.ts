import { describe, expect, it } from 'bun:test';
import { createLock } from '@template/db/lock/createLock';
import { getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const newId = () => `test-${crypto.randomUUID()}`;
const fastOpts = { ttlMs: 100, heartbeatMs: 30, maxMissed: 1 };
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('createLock', () => {
  describe('construction validation', () => {
    it('throws when maxMissed < 1', () => {
      expect(() => createLock({ service: 's', identifier: newId(), maxMissed: 0 })).toThrow('maxMissed must be >= 1');
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
      await getRedisClient().set(`${redisNamespace.lock}:s:${id}`, 'someone-else');
      expect(await lock.verify()).toBe(false);
      await lock.release();
    });
  });

  describe('release', () => {
    it('deletes the key when held', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await lock.release();
      const value = await getRedisClient().get(`${redisNamespace.lock}:s:${id}`);
      expect(value).toBeNull();
    });

    it('is no-op when lock has been taken over (preserves new holder)', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await getRedisClient().set(`${redisNamespace.lock}:s:${id}`, 'someone-else');
      await lock.release();
      const value = await getRedisClient().get(`${redisNamespace.lock}:s:${id}`);
      expect(value).toBe('someone-else');
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

    it('fires onLockLost after (maxMissed + 1) failed ticks', async () => {
      const id = newId();
      let lostCount = 0;
      const lock = createLock({
        service: 's',
        identifier: id,
        ...fastOpts,
        onLockLost: () => {
          lostCount += 1;
        },
      });
      await lock.acquire();
      await getRedisClient().del(`${redisNamespace.lock}:s:${id}`);
      await sleep(fastOpts.heartbeatMs * (fastOpts.maxMissed + 1) + 30);
      expect(lostCount).toBe(1);
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

    it('stops on release', async () => {
      const id = newId();
      const lock = createLock({ service: 's', identifier: id, ...fastOpts });
      await lock.acquire();
      await lock.release();
      await sleep(fastOpts.ttlMs + 50);
      const value = await getRedisClient().get(`${redisNamespace.lock}:s:${id}`);
      expect(value).toBeNull();
    });
  });
});

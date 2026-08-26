import { beforeEach, describe, expect, it } from 'bun:test';
import { cache, cacheKey, clearKey, upsertCache } from '@template/db/redis/cache';
import { getRedisClient } from '@template/db/redis/client';

beforeEach(async () => {
  await getRedisClient().flushall();
});

describe('cacheKey', () => {
  it('normalizes a model name to its accessor, so write and clear keys agree', () => {
    // The casing-drift bug: a call site keying with the model name must produce
    // the same key the reference map clears with the accessor name.
    expect(cacheKey('User', { email: 'a@b.com' })).toBe(cacheKey('user', { email: 'a@b.com' }));
    expect(cacheKey('Token', { keyHash: 'h' })).toBe(cacheKey('token', { keyHash: 'h' }));
  });

  it('passes a non-model segment through unchanged', () => {
    expect(cacheKey('somethingArbitrary', 'x')).toContain(':somethingArbitrary:');
  });

  it('is independent of composite identifier field order', () => {
    expect(cacheKey('user', { a: '1', b: '2' })).toBe(cacheKey('user', { b: '2', a: '1' }));
  });

  it('uses tags verbatim — opaque labels, never model-normalized', () => {
    expect(cacheKey('user', 'x', ['relations'])).toContain(':relations');
    // a tag that happens to collide with a model name is NOT rewritten
    expect(cacheKey('user', 'x', ['User'])).not.toBe(cacheKey('user', 'x', ['user']));
  });

  it('appends a wildcard segment only when requested', () => {
    expect(cacheKey('user', 'x', [], true).endsWith(':*')).toBe(true);
    expect(cacheKey('user', 'x', [], false).endsWith(':*')).toBe(false);
  });
});

describe('cache', () => {
  it('computes on miss and serves from cache on hit', async () => {
    const key = cacheKey('user', 'hit');
    let calls = 0;
    const fn = async () => {
      calls++;
      return { n: 1 };
    };
    expect(await cache(key, fn)).toEqual({ n: 1 });
    expect(await cache(key, fn)).toEqual({ n: 1 });
    expect(calls).toBe(1);
  });

  it('revives Date values across the round-trip', async () => {
    const key = cacheKey('user', 'date');
    const when = new Date('2026-01-02T03:04:05.000Z');
    await cache(key, async () => ({ when }));
    const hit = await cache<{ when: Date }>(key, async () => ({ when: new Date(0) }));
    expect(hit.when).toBeInstanceOf(Date);
    expect(hit.when.getTime()).toBe(when.getTime());
  });

  it('round-trips Map, Set, and BigInt values (superjson, not plain JSON)', async () => {
    const key = cacheKey('user', 'rich-types');
    const value = { map: new Map([['a', 1]]), set: new Set([1, 2, 3]), big: 42n };
    await cache(key, async () => value);
    const hit = await cache<typeof value>(key, async () => ({ map: new Map(), set: new Set(), big: 0n }));
    expect(hit.map).toBeInstanceOf(Map);
    expect(hit.map.get('a')).toBe(1);
    expect(hit.set).toBeInstanceOf(Set);
    expect([...hit.set]).toEqual([1, 2, 3]);
    expect(hit.big).toBe(42n);
  });

  it('treats a legacy plain-JSON entry as a miss and recomputes', async () => {
    const key = cacheKey('user', 'legacy');
    await getRedisClient().set(key, JSON.stringify({ n: 1 }));
    let recomputed = false;
    const hit = await cache(key, async () => {
      recomputed = true;
      return { n: 2 };
    });
    expect(recomputed).toBe(true);
    expect(hit).toEqual({ n: 2 });
  });

  it('single-flights concurrent misses on the same key into one compute', async () => {
    const key = cacheKey('user', 'stampede');
    let calls = 0;
    const slow = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return calls;
    };
    const results = await Promise.all([cache(key, slow), cache(key, slow), cache(key, slow)]);
    expect(calls).toBe(1);
    expect(results).toEqual([1, 1, 1]);
  });

  it('throws on a key containing "undefined" (a malformed-key signal)', async () => {
    await expect(cache('cache:user:id:undefined', async () => 1)).rejects.toThrow('undefined');
  });
});

describe('clearKey', () => {
  it('a model-cased write key is cleared by its accessor-cased clear key (the drift regression)', async () => {
    const writeKey = cacheKey('User', { email: 'x@y.com' });
    let calls = 0;
    const fn = async () => {
      calls++;
      return calls;
    };
    await cache(writeKey, fn); // populate → 1
    await cache(writeKey, fn); // hit → still 1
    expect(calls).toBe(1);

    await clearKey(cacheKey('user', { email: 'x@y.com' })); // the reference-map form

    await cache(writeKey, fn); // must recompute → 2
    expect(calls).toBe(2);
  });

  it('clears every entry matching a wildcard pattern', async () => {
    await cache(cacheKey('session', { userId: 'u1' }, ['a']), async () => 1);
    await cache(cacheKey('session', { userId: 'u1' }, ['b']), async () => 1);
    const deleted = await clearKey(cacheKey('session', { userId: 'u1' }, [], true));
    expect(deleted).toBeGreaterThanOrEqual(2);
  });
});

describe('cache single-flight failure modes', () => {
  it('does not hold the lock after the producer throws, so the next caller can compute', async () => {
    const key = cacheKey('user', 'throwing');
    let runs = 0;

    await expect(
      cache(key, async () => {
        runs += 1;
        throw new Error('producer failed');
      }),
    ).rejects.toThrow('producer failed');

    // A retained lock would make this wait out the full single-flight timeout.
    const started = Date.now();
    const result = await cache(key, async () => {
      runs += 1;
      return 'recovered';
    });

    expect(result).toBe('recovered');
    expect(runs).toBe(2);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('does not make a waiter sit out the timeout when the holder will never write a value', async () => {
    const key = cacheKey('user', 'uncacheable');
    let runs = 0;
    // A ttl of 0 means "return it, don't cache it" — so nothing ever appears for a waiter to read.
    const produce = async () => {
      runs += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'uncached';
    };

    const started = Date.now();
    const [first, second] = await Promise.all([cache(key, produce, 0), cache(key, produce, 0)]);

    expect(first).toBe('uncached');
    expect(second).toBe('uncached');
    // Both had to compute, which is correct; what matters is the second didn't wait out 20s first.
    expect(runs).toBe(2);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('leaves a lock alone once it has been retaken by someone else', async () => {
    const key = cacheKey('user', 'stolen');
    const lockKey = `${key}:singleflight`;

    const produce = async () => {
      // Stand in for a producer that outran the lock TTL: the lock is gone and a newer caller owns
      // one under the same name. Releasing unconditionally would delete theirs.
      await getRedisClient().set(lockKey, 'someone-elses-token');
      return 'done';
    };

    await cache(key, produce);

    expect(await getRedisClient().get(lockKey)).toBe('someone-elses-token');
  });

  it('holds the lock on a short lease, so a holder that dies mid-compute frees its waiters within seconds', async () => {
    const key = cacheKey('user', 'short-lease');
    const lockKey = `${key}:singleflight`;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const inFlight = cache(key, async () => {
      await gate;
      return 'done';
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    // The lease is what bounds an orphan: a process killed by a redeploy never runs its release,
    // and every waiter sits behind the lock until it expires.
    const lease = await getRedisClient().pttl(lockKey);
    expect(lease).toBeGreaterThan(0);
    expect(lease).toBeLessThanOrEqual(2_000);

    release();
    await inFlight;
  });

  it('keeps the lock alive past its lease while the producer is still running', async () => {
    const key = cacheKey('user', 'heartbeat');
    let calls = 0;
    const slowerThanLease = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 2_600));
      return calls;
    };

    const first = cache(key, slowerThanLease);
    // Arrive after the lease would have lapsed without a heartbeat: still single-flighted.
    await new Promise((resolve) => setTimeout(resolve, 2_300));
    const second = cache(key, slowerThanLease);

    expect(await Promise.all([first, second])).toEqual([1, 1]);
    expect(calls).toBe(1);
  });

  it('does not make a waiter sit out the full wait behind a lock nobody holds', async () => {
    const key = cacheKey('user', 'orphaned');
    const lockKey = `${key}:singleflight`;
    // Stand in for a dead holder: a lease that will lapse with no value ever written.
    await getRedisClient().set(lockKey, 'dead-holders-token', 'PX', 300);

    const started = Date.now();
    expect(await cache(key, async () => 'computed-ourselves')).toBe('computed-ourselves');
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('derives the ttl from the value when given a function', async () => {
    const key = cacheKey('user', 'ttl-fn');
    await cache(
      key,
      async () => ({ keep: true }),
      (value) => (value.keep ? 60 : 0),
    );
    const ttl = await getRedisClient().ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  });
});

describe('upsertCache', () => {
  it('is set-if-absent by default and overwrites under force', async () => {
    const key = cacheKey('user', 'upsert');
    expect(await upsertCache(key, { v: 1 })).toBe(true);
    expect(await upsertCache(key, { v: 2 })).toBe(false);
    expect(await cache(key, async () => ({ v: 9 }))).toEqual({ v: 1 });
    expect(await upsertCache(key, { v: 3 }, { force: true })).toBe(true);
    expect(await cache(key, async () => ({ v: 9 }))).toEqual({ v: 3 });
  });
});

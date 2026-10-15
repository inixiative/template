import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cacheKey } from '@template/db/redis/cache';
import { flushRedis, getRedisClient } from '@template/db/redis/client';
import { makeRollingCache } from '@template/db/redis/makeRollingCache';
import {
  getRollingCache,
  listRollingCaches,
  unregisterRollingCache,
} from '@template/db/redis/rollingCacheRegistry';
import {
  MIN_ROLLING_CACHE_INTERVAL_SECONDS,
  ROLLING_CACHE_LEAF_ATTEMPTS,
} from '@template/db/redis/rollingCacheTypes';

const registered: string[] = [];

const uniqueName = (label: string): string => {
  const name = `rollingCacheTest-${label}-${Bun.randomUUIDv7()}`;
  registered.push(name);
  return name;
};

describe('makeRollingCache', () => {
  beforeEach(async () => {
    await flushRedis();
  });

  afterEach(() => {
    for (const name of registered) unregisterRollingCache(name);
    registered.length = 0;
  });

  it('throws when a second cache registers under a name already taken', () => {
    const name = uniqueName('duplicate');
    makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => 1,
    });

    expect(() =>
      makeRollingCache({
        name,
        intervalSeconds: 300,
        key: () => cacheKey(name, 'all'),
        compute: async () => 2,
      }),
    ).toThrow(`Rolling cache "${name}" already registered`);
  });

  it('refuses an interval shorter than a few coordinator ticks, or not whole', () => {
    const short = uniqueName('short');
    const fractional = uniqueName('fractional');

    expect(() =>
      makeRollingCache({
        name: short,
        intervalSeconds: MIN_ROLLING_CACHE_INTERVAL_SECONDS - 1,
        key: () => cacheKey(short, 'all'),
        compute: async () => 1,
      }),
    ).toThrow(`at least ${MIN_ROLLING_CACHE_INTERVAL_SECONDS}`);
    expect(() =>
      makeRollingCache({
        name: fractional,
        intervalSeconds: 300.5,
        key: () => cacheKey(fractional, 'all'),
        compute: async () => 1,
      }),
    ).toThrow('whole number of seconds');
    expect(() => getRollingCache(short)).toThrow('is not registered');
    expect(() => getRollingCache(fractional)).toThrow('is not registered');
  });

  it('refuses a timeoutSeconds below one', () => {
    const name = uniqueName('timeout');

    expect(() =>
      makeRollingCache({
        name,
        intervalSeconds: 300,
        timeoutSeconds: 0,
        key: () => cacheKey(name, 'all'),
        compute: async () => 1,
      }),
    ).toThrow('timeoutSeconds');
  });

  it('refuses a ttl that would let an entry expire while its leaf is still on its last attempt', () => {
    const name = uniqueName('shortTtl');

    expect(() =>
      makeRollingCache({
        name,
        intervalSeconds: 300,
        timeoutSeconds: 300,
        ttlSeconds: 1260,
        key: () => cacheKey(name, 'all'),
        compute: async () => 1,
      }),
    ).toThrow('ttlSeconds longer than its interval plus every leaf attempt (1260s)');
  });

  it('throws when asked for a cache nobody registered', () => {
    expect(() => getRollingCache(`rollingCacheTest-missing-${Bun.randomUUIDv7()}`)).toThrow(
      'is not registered',
    );
  });

  it('registers the cache so the coordinator can find it by name', () => {
    const name = uniqueName('lookup');
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => 1,
    });

    expect(getRollingCache(name).name).toBe(name);
    expect(listRollingCaches().map((entry) => entry.name)).toContain(name);
    expect(rollingCache.timeoutSeconds).toBe(300);
  });

  it('keeps entries past the longest refresh, so a read always hits', async () => {
    const name = uniqueName('ttl');
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 600,
      key: () => cacheKey(name, 'all'),
      compute: async () => 'value',
    });

    await rollingCache.refresh();
    const ttl = await getRedisClient().ttl(cacheKey(name, 'all'));

    expect(rollingCache.ttlSeconds).toBe(600 * (ROLLING_CACHE_LEAF_ATTEMPTS + 2));
    expect(ttl).toBeGreaterThan(600 * (ROLLING_CACHE_LEAF_ATTEMPTS + 1));
    expect(ttl).toBeLessThanOrEqual(rollingCache.ttlSeconds);
  });

  it('computes once on a miss and serves the cached value after', async () => {
    const name = uniqueName('read');
    let runs = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => {
        runs += 1;
        return { runs };
      },
    });

    const first = await rollingCache.read();
    const second = await rollingCache.read();

    expect(runs).toBe(1);
    expect(first).toEqual({ runs: 1 });
    expect(second).toEqual({ runs: 1 });
  });

  it('refresh overwrites the live entry with a fresh computation', async () => {
    const name = uniqueName('refresh');
    let runs = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => {
        runs += 1;
        return runs;
      },
    });

    expect(await rollingCache.read()).toBe(1);
    expect(await rollingCache.refresh()).toBe(true);
    expect(await rollingCache.read()).toBe(2);
    expect(runs).toBe(2);
  });

  it('a refresh whose signal aborted during compute writes nothing', async () => {
    const name = uniqueName('aborted');
    const controller = new AbortController();
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => {
        controller.abort();
        return 'stale';
      },
    });

    expect(await rollingCache.refresh(undefined, { signal: controller.signal })).toBe(false);
    expect(await getRedisClient().exists(cacheKey(name, 'all'))).toBe(0);
  });

  it('a cache with no target selector has the single whole-system target', async () => {
    const name = uniqueName('untargeted');
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      key: () => cacheKey(name, 'all'),
      compute: async () => 'whole-system',
    });

    expect(await rollingCache.targets()).toEqual([undefined]);
  });
});

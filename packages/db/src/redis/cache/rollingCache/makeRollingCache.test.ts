import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cacheKey } from '@template/db/redis/cache/cacheKey';
import { makeRollingCache } from '@template/db/redis/cache/rollingCache/makeRollingCache';
import {
  getRollingCache,
  listRollingCaches,
  unregisterRollingCache,
} from '@template/db/redis/cache/rollingCache/rollingCacheRegistry';
import {
  MIN_ROLLING_CACHE_INTERVAL_SECONDS,
  ROLLING_CACHE_LEAF_ATTEMPTS,
  type RollingCacheComputeContext,
} from '@template/db/redis/cache/rollingCache/rollingCacheTypes';
import { flushRedis, getRedisClient } from '@template/db/redis/client';
import { redisNamespace } from '@template/db/redis/namespaces';

const registered: string[] = [];

const single = (name: string, compute: () => Promise<NonNullable<unknown>>) => ({
  results: { value: () => cacheKey(name, 'all') },
  compute: async (
    _target: unknown,
    { results, write }: RollingCacheComputeContext<{ value: () => string }>,
  ) => write(results.value(), await compute()),
});

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
    makeRollingCache({ name, intervalSeconds: 300, ...single(name, async () => 1) });

    expect(() =>
      makeRollingCache({ name, intervalSeconds: 300, ...single(name, async () => 2) }),
    ).toThrow(`Rolling cache "${name}" already registered`);
  });

  it('refuses an interval shorter than a few coordinator ticks, or not whole', () => {
    const short = uniqueName('short');
    const fractional = uniqueName('fractional');

    expect(() =>
      makeRollingCache({
        name: short,
        intervalSeconds: MIN_ROLLING_CACHE_INTERVAL_SECONDS - 1,
        ...single(short, async () => 1),
      }),
    ).toThrow(`at least ${MIN_ROLLING_CACHE_INTERVAL_SECONDS}`);
    expect(() =>
      makeRollingCache({
        name: fractional,
        intervalSeconds: 300.5,
        ...single(fractional, async () => 1),
      }),
    ).toThrow('whole number of seconds');
    expect(() => getRollingCache(short)).toThrow('is not registered');
    expect(() => getRollingCache(fractional)).toThrow('is not registered');
  });

  it('spreads its leaves over half the interval unless told otherwise, and refuses a spread as long as the interval', () => {
    const halved = uniqueName('halved');
    const tooWide = uniqueName('tooWide');

    expect(
      makeRollingCache({
        name: halved,
        intervalSeconds: 3600,
        ...single(halved, async () => 1),
      }).spreadSeconds,
    ).toBe(1800);
    expect(() =>
      makeRollingCache({
        name: tooWide,
        intervalSeconds: 300,
        spreadSeconds: 300,
        ...single(tooWide, async () => 1),
      }),
    ).toThrow('spreadSeconds');
  });

  it('refuses a timeoutSeconds below one', () => {
    const name = uniqueName('timeout');

    expect(() =>
      makeRollingCache({
        name,
        intervalSeconds: 300,
        timeoutSeconds: 0,
        ...single(name, async () => 1),
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
        ...single(name, async () => 1),
      }),
    ).toThrow('ttlSeconds longer than its interval plus every leaf attempt (1410s)');
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
      ...single(name, async () => 1),
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
      ...single(name, async () => 'value'),
    });

    await rollingCache.refresh();
    const ttl = await getRedisClient().ttl(cacheKey(name, 'all'));

    expect(rollingCache.ttlSeconds).toBe(600 * (ROLLING_CACHE_LEAF_ATTEMPTS + 2));
    expect(ttl).toBeGreaterThan(600 * (ROLLING_CACHE_LEAF_ATTEMPTS + 1));
    expect(ttl).toBeLessThanOrEqual(rollingCache.ttlSeconds);
  });

  it('a read never computes: it reports empty until a refresh lands, then the fresh value', async () => {
    const name = uniqueName('read');
    let runs = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => {
        runs += 1;
        return { runs };
      }),
    });

    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'empty' });
    expect(runs).toBe(0);

    await rollingCache.refresh();

    expect(await rollingCache.read('value', undefined)).toMatchObject({
      state: 'fresh',
      value: { runs: 1 },
      isComputing: false,
    });
    expect(runs).toBe(1);
  });

  it('refresh overwrites the live entry with a fresh computation', async () => {
    const name = uniqueName('refresh');
    let runs = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => {
        runs += 1;
        return runs;
      }),
    });

    await rollingCache.refresh();
    expect(await rollingCache.refresh()).toBe(true);
    expect(await rollingCache.read('value', undefined)).toMatchObject({ state: 'fresh', value: 2 });
  });

  it('reports computing while a refresh is running, before any value exists', async () => {
    const name = uniqueName('computing');
    let release: () => void = () => {};
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, () => new Promise<string>((resolve) => (release = () => resolve('done')))),
    });

    const refreshing = rollingCache.refresh();
    await Bun.sleep(20);
    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'computing' });

    release();
    await refreshing;
    expect(await rollingCache.read('value', undefined)).toMatchObject({
      state: 'fresh',
      value: 'done',
      isComputing: false,
    });
  });

  it('reports stale once the value is older than a scheduled refresh can take', async () => {
    const name = uniqueName('stale');
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => 'old'),
    });
    await rollingCache.refresh();

    const longAgo = Date.now() - 24 * 60 * 60 * 1000;
    await getRedisClient().set(
      `${redisNamespace.cacheWritten}:${cacheKey(name, 'all')}`,
      String(longAgo),
    );

    expect(await rollingCache.read('value', undefined)).toMatchObject({
      state: 'stale',
      value: 'old',
      isComputing: false,
    });
  });

  it('a refresh whose signal aborted during compute writes nothing', async () => {
    const name = uniqueName('aborted');
    const controller = new AbortController();
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => {
        controller.abort();
        return 'stale';
      }),
    });

    expect(await rollingCache.refresh(undefined, { signal: controller.signal })).toBe(false);
    expect(await getRedisClient().exists(cacheKey(name, 'all'))).toBe(0);
  });

  it('a cache with no target selector has the single whole-system target', async () => {
    const name = uniqueName('untargeted');
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => 'whole-system'),
    });

    expect(await rollingCache.targets()).toEqual([undefined]);
  });

  it('one refresh fills every result it declares, each read by its own params', async () => {
    const name = uniqueName('results');
    const organization = { id: `organization-${Bun.randomUUIDv7()}` };
    let release: () => void = () => {};
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      targets: { model: 'Organization', args: { select: { id: true } } },
      results: {
        all: ({ id }) => cacheKey(name, id),
        byKind: ({ id, kind }: { id: string; kind: string }) =>
          cacheKey(name, { organizationId: id, kind }),
      },
      compute: async ({ id }, { results, write }) => {
        await new Promise<void>((resolve) => (release = resolve));
        await write(results.all({ id }), { total: 3 });
        for (const [kind, count] of [
          ['a', 1],
          ['b', 2],
        ] as const) {
          await write(results.byKind({ id, kind }), { count });
        }
      },
    });

    const refreshing = rollingCache.refresh(organization);
    await Bun.sleep(20);
    expect(await rollingCache.read('all', organization)).toEqual({ state: 'computing' });
    expect(await rollingCache.read('byKind', { ...organization, kind: 'a' })).toEqual({
      state: 'computing',
    });

    release();
    expect(await refreshing).toBe(true);
    expect(await rollingCache.read('all', organization)).toMatchObject({
      state: 'fresh',
      value: { total: 3 },
    });
    expect(await rollingCache.read('byKind', { ...organization, kind: 'b' })).toMatchObject({
      state: 'fresh',
      value: { count: 2 },
    });
    expect(await rollingCache.read('byKind', { ...organization, kind: 'c' })).toEqual({
      state: 'empty',
    });
    expect(rollingCache.targetOf({ ...organization, kind: 'a' })).toEqual(organization);
  });

  it('refuses a cache that declares no results, and a read of a result it never declared', async () => {
    const name = uniqueName('noResults');
    expect(() =>
      makeRollingCache({ name, intervalSeconds: 300, results: {}, compute: async () => {} }),
    ).toThrow('declares no results');

    const declared = uniqueName('declared');
    const rollingCache = makeRollingCache({
      name: declared,
      intervalSeconds: 300,
      ...single(declared, async () => 1),
    });
    expect(() => rollingCache.read('other' as 'value', undefined)).toThrow('has no result "other"');
  });

  it('hands compute the signal, so a superseded pass stops between batches, and the next refresh waits for its lock', async () => {
    const name = uniqueName('abortable');
    const controller = new AbortController();
    let batches = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      timeoutSeconds: 5,
      results: { value: () => cacheKey(name, 'all') },
      compute: async (_target, { results, write, signal }) => {
        for (let batch = 0; batch < 50; batch++) {
          signal?.throwIfAborted();
          batches += 1;
          await Bun.sleep(10);
        }
        await write(results.value(), batches);
      },
    });

    const superseded = rollingCache.refresh(undefined, { signal: controller.signal });
    await Bun.sleep(25);
    controller.abort();
    const next = rollingCache.refresh();

    await expect(superseded).rejects.toThrow();
    expect(await next).toBe(true);
    expect(batches).toBeLessThan(100);
    expect(await rollingCache.read('value', undefined)).toMatchObject({ state: 'fresh' });
  });
  it('reports queued from the mark until the refresh takes the lock, and clears the mark once it writes', async () => {
    const name = uniqueName('queued');
    let release: () => void = () => {};
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, () => new Promise<string>((resolve) => (release = () => resolve('done')))),
    });

    expect(await rollingCache.markQueued(undefined)).toBe(true);
    expect(await rollingCache.markQueued(undefined)).toBe(false);
    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'queued' });

    const refreshing = rollingCache.refresh(undefined);
    await Bun.sleep(20);
    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'computing' });

    release();
    expect(await refreshing).toBe(true);
    expect(await rollingCache.read('value', undefined)).toMatchObject({
      state: 'fresh',
      value: 'done',
      isComputing: false,
      isQueued: false,
    });
    expect(await rollingCache.markQueued(undefined)).toBe(true);
  });

  it('a refresh aborted mid-compute leaves the mark, because its retry is still queued', async () => {
    const name = uniqueName('queuedAbort');
    const controller = new AbortController();
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      ...single(name, async () => {
        controller.abort();
        return 'late';
      }),
    });

    await rollingCache.markQueued(undefined);
    expect(await rollingCache.refresh(undefined, { signal: controller.signal })).toBe(false);
    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'queued' });
  });

  it('an abort releases the lock at once, so the next refresh does not wait on a compute that ignores the signal', async () => {
    const name = uniqueName('abortReleases');
    const controller = new AbortController();
    let finishStuck: () => void = () => {};
    let runs = 0;
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      timeoutSeconds: 5,
      results: { value: () => cacheKey(name, 'all') },
      compute: async (_target, { results, write }) => {
        runs += 1;
        if (runs === 1) await new Promise<void>((resolve) => (finishStuck = resolve));
        await write(results.value(), runs);
      },
    });

    const stuck = rollingCache.refresh(undefined, { signal: controller.signal });
    await Bun.sleep(20);
    controller.abort();
    const startedAt = performance.now();
    expect(await rollingCache.refresh()).toBe(true);
    expect(performance.now() - startedAt).toBeLessThan(1_000);

    finishStuck();
    expect(await stuck).toBe(false);
    expect(await rollingCache.read('value', undefined)).toMatchObject({ state: 'fresh', value: 2 });
  });
});

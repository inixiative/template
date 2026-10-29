import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cacheKey,
  claimLane,
  db,
  flushRedis,
  getRedisClient,
  laneKey,
  makeRollingCache,
  unregisterRollingCache,
} from '@template/db';
import { cleanupTouchedTables, createOrganization } from '@template/db/test';
import { enqueueJob } from '#/jobs/enqueue';
import { refreshRollingCacheTarget } from '#/jobs/handlers/refreshRollingCacheTarget';
import { createTestWorker } from '#tests/createTestWorker';

const registered: string[] = [];

describe('refreshRollingCacheTarget', () => {
  beforeEach(async () => {
    await flushRedis();
  });

  afterEach(async () => {
    for (const name of registered) unregisterRollingCache(name);
    registered.length = 0;
    await cleanupTouchedTables(db);
  });

  it('recomputes the target and overwrites the live entry', async () => {
    const { entity: organization } = await createOrganization({ name: 'Rolling Org' });
    const name = `organizationNames${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name);
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      results: { value: ({ id }) => cacheKey(name, id) },
      compute: async ({ id }, { results, write }) =>
        write(
          results.value({ id }),
          (await db.organization.findUniqueOrThrow({ where: { id } })).name,
        ),
      targets: { model: 'Organization', args: { select: { id: true } } },
    });
    const key = rollingCache.targetKey({ id: organization.id });

    await enqueueJob('refreshRollingCacheTarget', { name, key, target: { id: organization.id } });
    expect(await rollingCache.read('value', { id: organization.id })).toMatchObject({
      state: 'fresh',
      value: 'Rolling Org',
    });
    await db.organization.update({ where: { id: organization.id }, data: { name: 'Renamed Org' } });

    await enqueueJob('refreshRollingCacheTarget', { name, key, target: { id: organization.id } });

    expect(await rollingCache.read('value', { id: organization.id })).toMatchObject({
      value: 'Renamed Org',
    });
  });

  it('announces the refresh on the cache’s channel, and stays quiet for a cache without one', async () => {
    const name = `announcedCache${Bun.randomUUIDv7().slice(-8)}`;
    const silent = `silentCache${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name, silent);
    const announced = makeRollingCache({
      name,
      intervalSeconds: 300,
      results: { value: () => cacheKey(name, 'only') },
      compute: async (_target, { results, write }) => write(results.value(), 'value'),
      channel: () => `${name}Read`,
    });
    const quiet = makeRollingCache({
      name: silent,
      intervalSeconds: 300,
      results: { value: () => cacheKey(silent, 'only') },
      compute: async (_target, { results, write }) => write(results.value(), 'value'),
    });

    await enqueueJob('refreshRollingCacheTarget', {
      name,
      key: announced.targetKey(),
      target: null,
    });
    await enqueueJob('refreshRollingCacheTarget', {
      name: silent,
      key: quiet.targetKey(),
      target: null,
    });

    const events = await db.appEvent.findMany({ where: { name: 'rollingCache.refreshed' } });
    expect(events.map(({ data }) => data)).toContainEqual({
      rollingCache: name,
      key: announced.targetKey(),
      channel: `${name}Read`,
    });
    expect(events.map(({ data }) => data)).toContainEqual({
      rollingCache: silent,
      key: quiet.targetKey(),
    });
  });

  it('a leaf that outlives its timeout reports itself stuck, throws, and writes nothing late', async () => {
    const name = `hangingCache${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name);
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      timeoutSeconds: 1,
      results: { value: () => cacheKey(name, 'only') },
      compute: async (_target, { results, write }) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await write(results.value(), 'late');
      },
    });
    const key = rollingCache.targetKey();

    await expect(
      enqueueJob('refreshRollingCacheTarget', { name, key, target: null }),
    ).rejects.toThrow(`did not refresh ${key} within 1s`);
    await new Promise((resolve) => setTimeout(resolve, 700));

    const events = await db.appEvent.findMany({ where: { name: 'rollingCache.leafStuck' } });
    expect(events.map(({ data }) => data)).toContainEqual({
      rollingCache: name,
      key,
      target: null,
      timeoutSeconds: 1,
      attempt: 1,
    });
    expect(await getRedisClient().exists(rollingCache.results.value())).toBe(0);
  });

  it('a leaf that fails its last attempt clears the queued marker, so the next reader can queue again', async () => {
    const name = `failingCache${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name);
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      results: { value: () => cacheKey(name, 'only') },
      compute: async () => {
        throw new Error('compute failed');
      },
    });
    await rollingCache.markQueued(undefined);

    await expect(
      enqueueJob('refreshRollingCacheTarget', {
        name,
        key: rollingCache.targetKey(),
        target: null,
      }),
    ).rejects.toThrow('compute failed');

    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'empty' });
  });

  it('throws when no definition registered the name', async () => {
    const name = `removedCache${Bun.randomUUIDv7().slice(-8)}`;
    const key = cacheKey(name, 'organization');

    await expect(
      enqueueJob('refreshRollingCacheTarget', { name, key, target: { id: 'organization' } }),
    ).rejects.toThrow('is not registered');
    expect(await getRedisClient().exists(key)).toBe(0);
  });

  it('a superseded last attempt leaves the queued marker for the run that replaced it', async () => {
    const name = `supersededCache${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name);
    let isAborted: () => void = () => {};
    const aborted = new Promise<void>((resolve) => {
      isAborted = resolve;
    });
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      results: { value: () => cacheKey(name, 'only') },
      compute: async (_target, { signal }) => {
        while (!signal?.aborted) await Bun.sleep(10);
        isAborted();
        signal.throwIfAborted();
      },
    });
    const key = rollingCache.targetKey();
    await rollingCache.markQueued(undefined);
    const ctx = createTestWorker();

    const superseded = refreshRollingCacheTarget(ctx, { name, key, target: null });
    await Bun.sleep(100);
    await claimLane(laneKey(ctx.job.name, key), 'newer-job');
    await superseded.catch(() => {});
    await aborted;
    await Bun.sleep(50);

    expect(await rollingCache.read('value', undefined)).toEqual({ state: 'queued' });
  });
});

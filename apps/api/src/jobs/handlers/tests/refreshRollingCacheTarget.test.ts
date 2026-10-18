import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cacheKey,
  db,
  flushRedis,
  getRedisClient,
  makeRollingCache,
  unregisterRollingCache,
} from '@template/db';
import { cleanupTouchedTables, createOrganization } from '@template/db/test';
import { enqueueJob } from '#/jobs/enqueue';

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
      key: ({ id }) => cacheKey(name, id),
      compute: async ({ id }) => (await db.organization.findUniqueOrThrow({ where: { id } })).name,
      targets: { model: 'Organization', args: { select: { id: true } } },
    });
    const key = rollingCache.key({ id: organization.id });

    expect(await rollingCache.read({ id: organization.id })).toBe('Rolling Org');
    await db.organization.update({ where: { id: organization.id }, data: { name: 'Renamed Org' } });

    await enqueueJob('refreshRollingCacheTarget', { name, key, target: { id: organization.id } });

    expect(await rollingCache.read({ id: organization.id })).toBe('Renamed Org');
  });

  it('a leaf that outlives its timeout reports itself stuck, throws, and writes nothing late', async () => {
    const name = `hangingCache${Bun.randomUUIDv7().slice(-8)}`;
    registered.push(name);
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: 300,
      timeoutSeconds: 1,
      key: () => cacheKey(name, 'only'),
      compute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return 'late';
      },
    });
    const key = rollingCache.key();

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
    expect(await getRedisClient().exists(key)).toBe(0);
  });

  it('throws when no definition registered the name', async () => {
    const name = `removedCache${Bun.randomUUIDv7().slice(-8)}`;
    const key = cacheKey(name, 'organization');

    await expect(
      enqueueJob('refreshRollingCacheTarget', { name, key, target: { id: 'organization' } }),
    ).rejects.toThrow('is not registered');
    expect(await getRedisClient().exists(key)).toBe(0);
  });
});

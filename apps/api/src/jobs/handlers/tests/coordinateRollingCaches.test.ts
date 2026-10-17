import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cacheKey,
  db,
  flushRedis,
  getRedisClient,
  makeRollingCache,
  unregisterRollingCache,
} from '@template/db';
import { cleanupTouchedTables, createOrganization, createSpace } from '@template/db/test';
import { coordinateRollingCaches } from '#/jobs/handlers/coordinateRollingCaches';
import { rollingCacheTimerKey } from '#/jobs/rollingCacheTimerKey';
import { createTestWorker } from '#tests/createTestWorker';

const INTERVAL_SECONDS = 300;

const registered: string[] = [];

const uniqueName = (label: string): string => {
  const name = `coordinateTest${label}${Bun.randomUUIDv7().slice(-8)}`;
  registered.push(name);
  return name;
};

const coordinate = () => coordinateRollingCaches(createTestWorker());

const makeDue = (name: string) => getRedisClient().pexpire(rollingCacheTimerKey(name), 1_000);

// One target per organization that has a space named after the cache: `distinct` over Space.
const makeSpaceCountCache = (name: string, failingOrganizationId: () => string = () => '') =>
  makeRollingCache({
    name,
    intervalSeconds: INTERVAL_SECONDS,
    key: ({ organizationId }) => cacheKey(name, organizationId),
    compute: async ({ organizationId }) => {
      if (organizationId === failingOrganizationId()) throw new Error('compute failed');
      return db.space.count({ where: { organizationId, name: { startsWith: name } } });
    },
    targets: {
      model: 'Space',
      args: {
        where: { name: { startsWith: name } },
        distinct: ['organizationId'],
        select: { organizationId: true },
      },
    },
  });

describe('coordinateRollingCaches', () => {
  beforeEach(async () => {
    await flushRedis();
  });

  afterEach(async () => {
    for (const name of registered) unregisterRollingCache(name);
    registered.length = 0;
    await cleanupTouchedTables(db);
  });

  it('refreshes every target of a due cache, and the branch starts the timer when it closes', async () => {
    const name = uniqueName('Pairs');
    const { entity: acme } = await createOrganization();
    const { entity: globex } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    await createSpace({ name: `${name} b` }, { organization: acme });
    await createSpace({ name: `${name} c` }, { organization: globex });
    const rollingCache = makeSpaceCountCache(name);

    expect(await rollingCache.targets()).toHaveLength(2);
    await coordinate();

    expect(await getRedisClient().exists(cacheKey(name, acme.id))).toBe(1);
    expect(await rollingCache.read({ organizationId: acme.id })).toBe(2);
    expect(await rollingCache.read({ organizationId: globex.id })).toBe(1);
    expect(await getRedisClient().ttl(rollingCacheTimerKey(name))).toBeGreaterThan(
      INTERVAL_SECONDS - 5,
    );
  });

  it('leaves a cache alone while its timer has more than a tick left, and refreshes it once it runs out', async () => {
    const name = uniqueName('Timer');
    const { entity: acme } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    const rollingCache = makeSpaceCountCache(name);
    await coordinate();
    await createSpace({ name: `${name} b` }, { organization: acme });

    await coordinate();
    expect(await rollingCache.read({ organizationId: acme.id })).toBe(1);

    await makeDue(name);
    await coordinate();
    expect(await rollingCache.read({ organizationId: acme.id })).toBe(2);
  });

  it('targets are the rows of the selector’s own findMany args', async () => {
    const name = uniqueName('Select');
    const { entity: acme } = await createOrganization({ name: `${name} Acme` });
    const { entity: globex } = await createOrganization({ name: `${name} Globex` });
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: INTERVAL_SECONDS,
      key: ({ id }) => cacheKey(name, id),
      compute: async ({ name: organizationName }) => organizationName,
      targets: {
        model: 'Organization',
        args: { where: { name: { startsWith: name } }, select: { id: true, name: true } },
      },
    });

    await coordinate();

    expect(await rollingCache.read({ id: acme.id, name: 'ignored' })).toBe(`${name} Acme`);
    expect(await rollingCache.read({ id: globex.id, name: 'ignored' })).toBe(`${name} Globex`);
  });

  it('a leaf that fails keeps its last good value, and inline its failure fails the tick', async () => {
    const name = uniqueName('Failing');
    const { entity: broken } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: broken });
    let failingOrganizationId = '';
    const rollingCache = makeSpaceCountCache(name, () => failingOrganizationId);
    await coordinate();

    failingOrganizationId = broken.id;
    await createSpace({ name: `${name} b` }, { organization: broken });
    await makeDue(name);
    await expect(coordinate()).rejects.toThrow('compute failed');

    expect(await rollingCache.read({ organizationId: broken.id })).toBe(1);
  });
});

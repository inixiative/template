import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  cacheKey,
  db,
  flushRedis,
  getRedisClient,
  makeRollingCache,
  ROLLING_CACHE_LEAF_ATTEMPTS,
  ROLLING_CACHE_LEAF_BACKOFF_SECONDS,
  ROLLING_CACHE_TICK_SECONDS,
  unregisterRollingCache,
} from '@template/db';
import { cleanupTouchedTables, createOrganization, createSpace } from '@template/db/test';
import { WaitingChildrenError } from 'bullmq';
import { coordinateRollingCaches } from '#/jobs/handlers/coordinateRollingCaches';
import { refreshRollingCache } from '#/jobs/handlers/refreshRollingCache';
import { queue } from '#/jobs/queue';
import { rollingCacheTimerKey } from '#/jobs/rollingCacheTimerKey';
import { createTestWorker } from '#tests/createTestWorker';

const INTERVAL_SECONDS = 300;

const registered: string[] = [];

const uniqueName = (label: string): string => {
  const name = `coordinateTest${label}${Bun.randomUUIDv7().slice(-8)}`;
  registered.push(name);
  return name;
};

const coordinate = (tick = 'coordinateRollingCaches') =>
  coordinateRollingCaches(createTestWorker({ name: tick }));

const makeDue = (name: string) => getRedisClient().pexpire(rollingCacheTimerKey(name), 1_000);

// One target per organization that has a space named after the cache: `distinct` over Space.
const makeSpaceCountCache = (
  name: string,
  failingOrganizationId: () => string = () => '',
  spreadSeconds = 0,
  beforeCompute: () => Promise<void> = async () => {},
) =>
  makeRollingCache({
    name,
    intervalSeconds: INTERVAL_SECONDS,
    spreadSeconds,
    results: { value: ({ organizationId }) => cacheKey(name, organizationId) },
    compute: async ({ organizationId }, { results, write }) => {
      await beforeCompute();
      if (organizationId === failingOrganizationId()) throw new Error('compute failed');
      await write(
        results.value({ organizationId }),
        await db.space.count({ where: { organizationId, name: { startsWith: name } } }),
      );
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

  it('refreshes every target of a due cache, and starts its timer for one interval', async () => {
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
    expect(await rollingCache.read('value', { organizationId: acme.id })).toMatchObject({
      state: 'fresh',
      value: 2,
    });
    expect(await rollingCache.read('value', { organizationId: globex.id })).toMatchObject({
      value: 1,
    });
    expect(await getRedisClient().ttl(rollingCacheTimerKey(name))).toBeGreaterThan(
      INTERVAL_SECONDS - 5,
    );
  });

  // Under a worker the branch parks in `waiting-children` after its stage; the timer is already running.
  it('starts the timer when the pass starts, while its leaves are still out', async () => {
    const name = uniqueName('Start');
    const { entity: acme } = await createOrganization();
    const { entity: globex } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    await createSpace({ name: `${name} b` }, { organization: globex });
    const rollingCache = makeSpaceCountCache(name, () => '', INTERVAL_SECONDS / 2);
    const branch = createTestWorker({
      name: 'refreshRollingCache',
      token: 'worker-token',
      updateData: mock(async () => {}),
      moveToWaitingChildren: mock(async () => true),
    });

    await expect(refreshRollingCache(branch, { name })).rejects.toBeInstanceOf(
      WaitingChildrenError,
    );

    const states = await Promise.all(
      [acme, globex].map(
        async ({ id }) => (await rollingCache.read('value', { organizationId: id })).state,
      ),
    );
    expect(states).toContain('empty');
    expect(await getRedisClient().ttl(rollingCacheTimerKey(name))).toBeGreaterThan(
      INTERVAL_SECONDS - 5,
    );
  });

  // Inline the leaf runs inside the stage, so this is the singleton lock at work; the deduplication that
  // guards a parked branch under a worker is checked against real Redis by jobFlowCheck.
  it('the singleton lock skips a second branch while a pass is running inline', async () => {
    const name = uniqueName('Overlap');
    const { entity: acme } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    let computes = 0;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = () => {};
    const isStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    makeSpaceCountCache(
      name,
      () => '',
      0,
      async () => {
        computes += 1;
        started();
        if (computes === 1) await held;
      },
    );

    const firstPass = coordinate('firstTick');
    await Promise.race([isStarted, firstPass]);
    await coordinate('secondTick');
    expect(computes).toBe(1);

    release();
    await firstPass;
    await makeDue(name);
    await coordinate('thirdTick');
    expect(computes).toBe(2);
  });

  it('validates ttl against the queue’s real leaf attempts and retry backoff', () => {
    const { attempts, backoff } = queue.defaultJobOptions;
    const { delay } = backoff as { type: string; delay: number };
    const backoffMs = Array.from({ length: (attempts ?? 1) - 1 }, (_, retry) => delay * 2 ** retry);

    expect(attempts).toBe(ROLLING_CACHE_LEAF_ATTEMPTS);
    expect(backoff).toMatchObject({ type: 'exponential' });
    expect(backoffMs.reduce((sum, ms) => sum + ms, 0) / 1000).toBe(
      ROLLING_CACHE_LEAF_BACKOFF_SECONDS,
    );
  });

  it('spaces a cache’s leaves across its spread, so only the first starts at once', async () => {
    const name = uniqueName('Spread');
    const { entity: acme } = await createOrganization();
    const { entity: globex } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    await createSpace({ name: `${name} b` }, { organization: globex });
    const rollingCache = makeSpaceCountCache(name, () => '', INTERVAL_SECONDS / 2);

    await coordinate();

    const states = await Promise.all(
      [acme, globex].map(
        async ({ id }) => (await rollingCache.read('value', { organizationId: id })).state,
      ),
    );
    expect(states.sort()).toEqual(['empty', 'fresh']);
  });

  it('leaves a cache alone while its timer has more than a tick left, and refreshes it once it runs out', async () => {
    const name = uniqueName('Timer');
    const { entity: acme } = await createOrganization();
    await createSpace({ name: `${name} a` }, { organization: acme });
    const rollingCache = makeSpaceCountCache(name);
    await coordinate();
    await createSpace({ name: `${name} b` }, { organization: acme });

    await coordinate();
    expect(await rollingCache.read('value', { organizationId: acme.id })).toMatchObject({
      value: 1,
    });

    await makeDue(name);
    await coordinate();
    expect(await rollingCache.read('value', { organizationId: acme.id })).toMatchObject({
      value: 2,
    });
  });

  it('targets are the rows of the selector’s own findMany args', async () => {
    const name = uniqueName('Select');
    const { entity: acme } = await createOrganization({ name: `${name} Acme` });
    const { entity: globex } = await createOrganization({ name: `${name} Globex` });
    const rollingCache = makeRollingCache({
      name,
      intervalSeconds: INTERVAL_SECONDS,
      spreadSeconds: 0,
      results: { value: ({ id }) => cacheKey(name, id) },
      compute: async (target, { results, write }) => write(results.value(target), target.name),
      targets: {
        model: 'Organization',
        args: { where: { name: { startsWith: name } }, select: { id: true, name: true } },
      },
    });

    await coordinate();

    expect(await rollingCache.read('value', { id: acme.id, name: 'ignored' })).toMatchObject({
      value: `${name} Acme`,
    });
    expect(await rollingCache.read('value', { id: globex.id, name: 'ignored' })).toMatchObject({
      value: `${name} Globex`,
    });
  });

  it('a leaf that fails keeps its last good value, and inline its failure fails the tick and leaves the cache due', async () => {
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

    expect(await rollingCache.read('value', { organizationId: broken.id })).toMatchObject({
      value: 1,
    });
    expect(await getRedisClient().pttl(rollingCacheTimerKey(name))).toBeLessThanOrEqual(
      ROLLING_CACHE_TICK_SECONDS * 1000,
    );
  });
});

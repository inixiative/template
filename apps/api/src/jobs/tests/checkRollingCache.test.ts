import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cacheKey,
  flushRedis,
  getRedisClient,
  makeRollingCache,
  redisNamespace,
  unregisterRollingCache,
} from '@template/db';
import { checkRollingCache } from '#/jobs/checkRollingCache';

const registered: string[] = [];

const makeCountingCache = () => {
  const name = `checkRollingCache${Bun.randomUUIDv7().slice(-8)}`;
  registered.push(name);
  let runs = 0;
  const rollingCache = makeRollingCache({
    name,
    intervalSeconds: 300,
    results: { value: () => cacheKey(name, 'only') },
    compute: async (_target, { results, write }) => {
      runs += 1;
      await write(results.value(), runs);
    },
    channel: () => `${name}Read`,
  });
  return { name, rollingCache, runs: () => runs };
};

describe('checkRollingCache', () => {
  beforeEach(async () => {
    await flushRedis();
  });

  afterEach(() => {
    for (const name of registered) unregisterRollingCache(name);
    registered.length = 0;
  });

  it('an empty cache queues its leaf and answers with where to subscribe', async () => {
    const { name, rollingCache, runs } = makeCountingCache();

    const check = await checkRollingCache(rollingCache, 'value', undefined);

    expect(runs()).toBe(1);
    expect(check).toMatchObject({ state: 'fresh', value: 1, channel: `${name}Read` });
  });

  it('a fresh cache is served as is, with nothing queued', async () => {
    const { rollingCache, runs } = makeCountingCache();
    await rollingCache.refresh();

    expect(await checkRollingCache(rollingCache, 'value', undefined)).toMatchObject({
      state: 'fresh',
      value: 1,
    });
    expect(runs()).toBe(1);
  });

  it('a stale cache queues a refresh behind the value it serves', async () => {
    const { rollingCache, runs } = makeCountingCache();
    await rollingCache.refresh();
    await getRedisClient().set(
      `${redisNamespace.cacheWritten}:${rollingCache.results.value()}`,
      String(Date.now() - 86_400_000),
    );

    expect(await checkRollingCache(rollingCache, 'value', undefined)).toMatchObject({
      state: 'fresh',
      value: 2,
    });
    expect(runs()).toBe(2);
  });
});

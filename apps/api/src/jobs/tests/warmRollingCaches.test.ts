import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  cacheKey,
  flushRedis,
  getRedisClient,
  makeRollingCache,
  unregisterRollingCache,
} from '@template/db';
import { rollingCacheTimerKey } from '#/jobs/rollingCacheTimerKey';
import { warmRollingCaches } from '#/jobs/warmRollingCaches';

const name = `warmRollingCaches${Bun.randomUUIDv7().slice(-8)}`;

describe('warmRollingCaches', () => {
  beforeEach(async () => {
    await flushRedis();
  });

  afterEach(() => {
    unregisterRollingCache(name);
  });

  it('refreshes a cache whose timer is still running, as after a deploy that changed its keys', async () => {
    let runs = 0;
    makeRollingCache({
      name,
      intervalSeconds: 300,
      spreadSeconds: 0,
      results: { value: () => cacheKey(name, 'only') },
      compute: async (_target, { results, write }) => {
        runs += 1;
        await write(results.value(), runs);
      },
    });
    await getRedisClient().set(rollingCacheTimerKey(name), String(Date.now()), 'EX', 300);

    await warmRollingCaches();

    expect(runs).toBe(1);
    expect(await getRedisClient().pttl(rollingCacheTimerKey(name))).toBeGreaterThan(0);
  });
});

import { beforeEach, describe, expect, it } from 'bun:test';
import { getRedisClient } from '@template/db';

import { incrementFixedWindows } from '#/middleware/rateLimit/incrementFixedWindows';

describe('incrementFixedWindows', () => {
  beforeEach(async () => {
    const keys = await getRedisClient().keys('itest:*');
    if (keys.length) await getRedisClient().del(...keys);
  });

  it('increments each window and reports its count + remaining ttl', async () => {
    const redis = getRedisClient();
    const windows = [
      { key: 'itest:a', windowMs: 60_000 },
      { key: 'itest:b', windowMs: 30_000 },
    ];

    const first = await incrementFixedWindows(redis, windows);
    expect(first.map((w) => w.count)).toEqual([1, 1]);
    expect(first[0]?.ttlMs).toBeGreaterThan(0);
    expect(first[0]?.ttlMs).toBeLessThanOrEqual(60_000);

    const second = await incrementFixedWindows(redis, windows);
    expect(second.map((w) => w.count)).toEqual([2, 2]);
  });

  it('counts each key independently', async () => {
    const redis = getRedisClient();
    await incrementFixedWindows(redis, [{ key: 'itest:a', windowMs: 60_000 }]);
    await incrementFixedWindows(redis, [{ key: 'itest:a', windowMs: 60_000 }]);

    const [a] = await incrementFixedWindows(redis, [{ key: 'itest:a', windowMs: 60_000 }]);
    const [b] = await incrementFixedWindows(redis, [{ key: 'itest:b', windowMs: 60_000 }]);
    expect(a?.count).toBe(3);
    expect(b?.count).toBe(1);
  });
});

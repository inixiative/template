import { describe, expect, test } from 'bun:test';
import { resolveRedisUrl } from '@template/db/redis/client';
import { setEnvOverride } from '@template/shared/utils';

describe('resolveRedisUrl', () => {
  test('uses the explicit url when one is given', () => {
    setEnvOverride('REDIS_URL', 'redis://red-shared:6379');
    expect(resolveRedisUrl('redis://red-dedicated:6379')).toBe('redis://red-dedicated:6379');
  });

  test('falls back to REDIS_URL when no url is given', () => {
    setEnvOverride('REDIS_URL', 'redis://red-shared:6379');
    expect(resolveRedisUrl()).toBe('redis://red-shared:6379');
    expect(resolveRedisUrl(undefined)).toBe('redis://red-shared:6379');
  });

  test('falls back to localhost when nothing names a store', () => {
    setEnvOverride('REDIS_URL', undefined);
    expect(resolveRedisUrl()).toBe('redis://localhost:6379');
  });
});

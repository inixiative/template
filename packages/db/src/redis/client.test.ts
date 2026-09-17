import { afterEach, describe, expect, test } from 'bun:test';
import { resolveRedisUrl } from '@template/db/redis/client';

const original = process.env.REDIS_URL;

afterEach(() => {
  if (original === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = original;
});

describe('resolveRedisUrl', () => {
  test('uses the explicit url when one is given', () => {
    process.env.REDIS_URL = 'redis://red-shared:6379';
    expect(resolveRedisUrl('redis://red-dedicated:6379')).toBe('redis://red-dedicated:6379');
  });

  test('falls back to REDIS_URL when no url is given', () => {
    process.env.REDIS_URL = 'redis://red-shared:6379';
    expect(resolveRedisUrl()).toBe('redis://red-shared:6379');
    expect(resolveRedisUrl(undefined)).toBe('redis://red-shared:6379');
  });

  test('falls back to localhost when nothing names a store', () => {
    delete process.env.REDIS_URL;
    expect(resolveRedisUrl()).toBe('redis://localhost:6379');
  });
});

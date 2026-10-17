import { afterEach, describe, expect, test } from 'bun:test';
import { resolveBullmqRedisUrl } from '#/jobs/bullmqRedisUrl';

const original = { bullmq: process.env.REDIS_BULLMQ_URL, shared: process.env.REDIS_URL };

const setEnv = (key: 'REDIS_BULLMQ_URL' | 'REDIS_URL', value: string | undefined) => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};

afterEach(() => {
  setEnv('REDIS_BULLMQ_URL', original.bullmq);
  setEnv('REDIS_URL', original.shared);
});

describe('resolveBullmqRedisUrl', () => {
  test('returns undefined instead of throwing when neither variable is set', () => {
    setEnv('REDIS_BULLMQ_URL', undefined);
    setEnv('REDIS_URL', undefined);

    expect(() => resolveBullmqRedisUrl()).not.toThrow();
    expect(resolveBullmqRedisUrl()).toBeUndefined();
  });

  test('prefers the dedicated queue store when it is configured', () => {
    setEnv('REDIS_BULLMQ_URL', 'redis://red-dedicated:6379');
    setEnv('REDIS_URL', 'redis://red-shared:6379');

    expect(resolveBullmqRedisUrl()).toBe('redis://red-dedicated:6379');
  });

  test('falls back to the shared store so nothing changes until the variable is set', () => {
    setEnv('REDIS_BULLMQ_URL', undefined);
    setEnv('REDIS_URL', 'redis://red-shared:6379');

    expect(resolveBullmqRedisUrl()).toBe('redis://red-shared:6379');
  });
});

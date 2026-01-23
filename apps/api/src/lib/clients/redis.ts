/**
 * Redis Client
 *
 * Used for:
 * - BullMQ job queues
 * - Caching (optional)
 * - Rate limiting (optional)
 *
 * Required environment variables:
 * - REDIS_URL
 */

import { env } from '@src/config/env';

// Lazy-loaded client
let _redisClient: Awaited<ReturnType<typeof createRedisClient>> | null = null;

export async function createRedisClient() {
  // Use ioredis-mock in test environment
  if (env.isTest) {
    const IORedisMock = (await import('ioredis-mock')).default;
    return new IORedisMock();
  }

  const Redis = (await import('ioredis')).default;

  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

export async function getRedisClient() {
  if (!_redisClient) {
    _redisClient = await createRedisClient();

    // Log connection events in non-test environments
    if (!env.isTest) {
      _redisClient.on('connect', () => console.log('✅ Redis connected'));
      _redisClient.on('error', (err) => console.error('❌ Redis error:', err));
    }
  }
  return _redisClient;
}

import { log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

/**
 * Redis Connection Strategy:
 *
 * We maintain 2 application-managed connections:
 * 1. Main client - for all regular commands (cache, otp, session, flags, rate limits)
 * 2. Subscriber - dedicated for pub/sub (subscribe is blocking, needs own connection)
 *
 * BullMQ manages its own connections internally - we just pass createRedisConnection.
 *
 * In test mode, all connections share a single in-memory mock.
 */

let __main: Redis | null = null;
let __subscriber: Redis | null = null;
let __mock: Redis | null = null;

export const createRedisConnection = (name = 'Redis'): Redis => {
  if (isTest) {
    if (!__mock) __mock = new RedisMock() as unknown as Redis;
    log.info(`[${name}] Using shared in-memory mock`);
    return __mock;
  }

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('error', (err) => log.error(`[${name}] Error:`, err));
  redis.on('connect', () => log.info(`[${name}] Connected`));

  return redis;
};

/** Main Redis client for all regular operations (cache, otp, session, flags, rate limits) */
export const getRedisClient = (): Redis => {
  if (!__main) __main = createRedisConnection('Redis:Main');
  return __main;
};

/** Publisher uses main client (pub commands don't block) */
export const getRedisPub = (): Redis => getRedisClient();

/** Dedicated subscriber connection (subscribe is blocking) */
export const getRedisSub = (): Redis => {
  if (!__subscriber) __subscriber = createRedisConnection('Redis:Subscriber');
  return __subscriber;
};

export const flushRedis = async (): Promise<void> => {
  if (!isTest) throw new Error('flushRedis() can only be called in test environment');
  await getRedisClient().flushall();
};

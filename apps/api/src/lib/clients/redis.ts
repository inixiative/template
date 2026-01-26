import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { env } from '#/config/env';
import { log } from '#/lib/logger';

let _redisClient: Redis | null = null;
let _redisSub: Redis | null = null;

export const createRedisConnection = (name = 'Redis'): Redis => {
  if (env.isTest) {
    log.info(`[${name}] Using in-memory mock`);
    return new RedisMock() as unknown as Redis;
  }

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('error', (err) => log.error(`[${name}] Error:`, err));
  redis.on('connect', () => log.info(`[${name}] Connected`));

  return redis;
};

export const getRedisClient = (): Redis => {
  if (!_redisClient) {
    _redisClient = createRedisConnection('Redis');
  }
  return _redisClient;
};

export const getRedisPub = (): Redis => getRedisClient();

export const getRedisSub = (): Redis => {
  if (!_redisSub) {
    _redisSub = createRedisConnection('RedisSub');
  }
  return _redisSub;
};

export const flushRedis = async (): Promise<void> => {
  if (!env.isTest) throw new Error('flushRedis() can only be called in test environment');
  await getRedisClient().flushall();
};

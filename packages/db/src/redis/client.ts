import { LogScope, log } from '@template/shared/logger';
import { isTest } from '@template/shared/utils';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

let __main: Redis | null = null;
let __subscriber: Redis | null = null;
let __mock: Redis | null = null;

export const createRedisConnection = (scope: LogScope | string = LogScope.db): Redis => {
  if (isTest) {
    if (!__mock) __mock = new RedisMock() as unknown as Redis;
    log.info('Using shared in-memory mock', scope);
    return __mock;
  }

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on('error', (err) => log.error('Error:', err, scope));
  redis.on('connect', () => log.info('Connected', scope));

  return redis;
};

export const getRedisClient = (): Redis => {
  if (!__main) __main = createRedisConnection(LogScope.db);
  return __main;
};

export const getRedisPub = (): Redis => getRedisClient();

export const getRedisSub = (): Redis => {
  if (!__subscriber) __subscriber = createRedisConnection(LogScope.ws);
  return __subscriber;
};

export const flushRedis = async (): Promise<void> => {
  if (!isTest) throw new Error('flushRedis() can only be called in test environment');
  await getRedisClient().flushall();
};

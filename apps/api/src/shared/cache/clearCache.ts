import type { Redis } from 'ioredis';

export const clearCacheKey = async (redis: Redis, pattern: string): Promise<void> => {
  const stream = redis.scanStream({
    match: pattern,
    count: 100
  });
  
  const pipeline = redis.pipeline();
  
  for await (const keys of stream) {
    if (keys.length) {
      keys.forEach((key: string) => {
        pipeline.del(key);
      });
    }
  }
  
  await pipeline.exec();
};

export const clearAllCache = async (redis: Redis): Promise<void> => {
  await redis.flushdb();
};
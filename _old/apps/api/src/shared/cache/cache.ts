import type { Redis } from 'ioredis';

const DEFAULT_TTL = 60 * 60 * 24; // 24 hours

export const cache = async <T>(
  redis: Redis,
  key: string,
  cb: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> => {
  if (key.includes('undefined')) throw new Error('Cache key cannot include undefined');
  
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const value = await cb();
  
  await redis.setex(key, ttl, JSON.stringify(value));
  return value;
};
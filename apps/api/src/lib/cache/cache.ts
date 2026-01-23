import { env } from '@src/config/env';
import { getRedisClient } from '@src/lib/clients/redis';

const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Get a value from cache.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (env.isTest) key = `test:${key}`;

  // Guard against undefined in key (prevents invalid cache)
  if (key.includes('undefined')) {
    console.warn(`Cache key contains 'undefined': ${key}`);
    return null;
  }

  try {
    const redis = await getRedisClient();
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Cache get failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Set a value in cache.
 */
export async function setCache<T>(
  key: string,
  value: T,
  expirySeconds: number = DEFAULT_EXPIRY_SECONDS,
): Promise<void> {
  if (env.isTest) key = `test:${key}`;

  // Guard against undefined in key
  if (key.includes('undefined')) {
    console.warn(`Refusing to cache with 'undefined' in key: ${key}`);
    return;
  }

  try {
    const redis = await getRedisClient();
    await redis.setex(key, expirySeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`Cache set failed for key ${key}:`, error);
  }
}

/**
 * Delete a specific key from cache.
 */
export async function deleteCache(key: string): Promise<void> {
  if (env.isTest) key = `test:${key}`;

  try {
    const redis = await getRedisClient();
    await redis.del(key);
  } catch (error) {
    console.error(`Cache delete failed for key ${key}:`, error);
  }
}

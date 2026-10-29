/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import type { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';

export type Generation = string;

export const readGeneration = async (
  redis: ReturnType<typeof getRedisClient>,
  key: string,
): Promise<Generation | null> => {
  try {
    return (await redis.get(generationKey(key))) ?? '0';
  } catch (error) {
    log.error(`Cache generation read error for key ${key}:`, error);
    return null;
  }
};

/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { epochKey } from '@template/db/redis/cache/generation/epochKey';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import type { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';

export type Generation = { generation: string; epoch: string };

// Captured before the producer runs. Null when Redis cannot answer: the caller then computes and
// returns the value without publishing it, because it cannot prove no clear ran meanwhile.
export const readGeneration = async (
  redis: ReturnType<typeof getRedisClient>,
  key: string,
): Promise<Generation | null> => {
  try {
    const [generation, epoch] = await redis.mget(generationKey(key), epochKey());
    return { generation: generation ?? '0', epoch: epoch ?? '0' };
  } catch (error) {
    log.error(`Cache generation read error for key ${key}:`, error);
    return null;
  }
};

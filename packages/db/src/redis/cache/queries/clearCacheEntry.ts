/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Deletes the value and its write time together; returns how many values were deleted.
const CLEAR_CACHE_ENTRY = `
redis.call('del', KEYS[2])
return redis.call('del', KEYS[1])
`;

export const clearCacheEntry = async (
  redis: RedisEval,
  { key, writtenKey }: { key: string; writtenKey: string },
): Promise<number> => Number(await redis.eval(CLEAR_CACHE_ENTRY, 2, key, writtenKey));

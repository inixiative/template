/**
 * @atlas
 * @kind query
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import type { RedisEval } from '@template/db/redis/types';

// Deletes the value and its write time and moves the key's generation in one step, so a compute that
// read before the clear can never publish after it. Returns how many values were deleted.
const CLEAR_EXACT = `
local deleted = redis.call('del', KEYS[1])
redis.call('del', KEYS[3])
redis.call('set', KEYS[2], ARGV[1], 'EX', ARGV[2])
return deleted
`;

export const clearExact = async (
  redis: RedisEval,
  keys: { key: string; generationKey: string; writtenKey: string },
  generation: string,
  generationTtlSeconds: number,
): Promise<number> =>
  Number(
    await redis.eval(
      CLEAR_EXACT,
      3,
      keys.key,
      keys.generationKey,
      keys.writtenKey,
      generation,
      String(generationTtlSeconds),
    ),
  );

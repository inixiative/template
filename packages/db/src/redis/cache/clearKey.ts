/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { singleFlightLockKey } from '@template/db/lock/singleFlight/singleFlightLock';
import { isPattern } from '@template/db/redis/cache/cachePattern';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import {
  GENERATION_TTL_SECONDS,
  newGeneration,
} from '@template/db/redis/cache/generation/newGeneration';
import { clearExact } from '@template/db/redis/cache/queries/clearExact';
import { validateKey } from '@template/db/redis/cache/validateKey';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { sum } from 'lodash-es';

const clearOne = (redis: ReturnType<typeof getRedisClient>, key: string): Promise<number> =>
  clearExact(
    redis,
    { key, generationKey: generationKey(key), writtenKey: writtenKey(key) },
    newGeneration(),
    GENERATION_TTL_SECONDS,
  );

export const clearKey = async (pattern: string): Promise<number> => {
  validateKey(pattern);
  const isPatternClear = isPattern(pattern);

  try {
    const redis = getRedisClient();

    if (!isPatternClear) {
      const deleted = await clearOne(redis, pattern);
      if (deleted) log.debug(`Cleared cache key: ${pattern}`);
      return deleted;
    }

    let deleted = 0;
    const lockPrefix = singleFlightLockKey('');
    for await (const lockKeys of redis.scanStream({
      match: singleFlightLockKey(pattern),
      count: 100,
    })) {
      const cleared = await Promise.all(
        (lockKeys as string[]).map((lockKey) => clearOne(redis, lockKey.slice(lockPrefix.length))),
      );
      deleted += sum(cleared);
    }

    const stream = redis.scanStream({ match: pattern, count: 100 });

    for await (const keys of stream) {
      if (keys.length > 0) {
        await redis.del(...keys);
        deleted += keys.length;
      }
    }

    if (deleted > 0) log.debug(`Cleared ${deleted} cache entries for pattern: ${pattern}`);
    return deleted;
  } catch (error) {
    log.error(`Failed to clear cache for pattern ${pattern}:`, error);
    if (isPatternClear) throw error;
    return 0;
  }
};

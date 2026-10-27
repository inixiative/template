/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { DEFAULT_TTL } from '@template/db/redis/cache/defaultTtl';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import {
  GENERATION_TTL_SECONDS,
  newGeneration,
} from '@template/db/redis/cache/generation/newGeneration';
import { writeThrough } from '@template/db/redis/cache/queries/writeThrough';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import { withCacheSpan } from '@template/db/redis/cache/telemetry/withCacheSpan';
import { validateKey } from '@template/db/redis/cache/validateKey';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import superjson from 'superjson';

export const upsertCache = async <T>(
  key: string,
  value: T,
  options: { ttl?: number; force?: boolean } = {},
): Promise<boolean> => {
  const { ttl = DEFAULT_TTL, force = false } = options;
  validateKey(key);

  return withCacheSpan(key, false, async (setResult) => {
    try {
      const redis = getRedisClient();
      if (!force && (await redis.exists(key))) {
        setResult('hit');
        return false;
      }
      const payload = superjson.stringify(value);
      await writeThrough(
        redis,
        { key, generationKey: generationKey(key), writtenKey: writtenKey(key) },
        { value: newGeneration(), ttlSeconds: GENERATION_TTL_SECONDS },
        ttl,
        payload,
      );
      meterLargeWrite(key, payload, ttl, 'upsertCache');
      setResult('miss');
      return true;
    } catch {
      setResult('error');
      return false;
    }
  });
};

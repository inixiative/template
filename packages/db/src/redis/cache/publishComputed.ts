/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis, infrastructure:observability
 * @uses none
 */
import { singleFlightLockKey } from '@template/db/lock/singleFlight/singleFlightLock';
import { cacheWrittenMarkerKeyFor } from '@template/db/redis/cache/cacheWrittenMarkerKeyFor';
import type { Generation } from '@template/db/redis/cache/generation/fetchCacheGeneration';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import { publishIfCurrent } from '@template/db/redis/cache/queries/publishIfCurrent';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import type { RedisEval } from '@template/db/redis/types';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';

export const publishComputed = async (
  redis: RedisEval,
  key: string,
  captured: Generation,
  holder: string,
  ttlSeconds: number,
  payload: string,
): Promise<void> => {
  try {
    const published = await publishIfCurrent(
      redis,
      {
        key,
        generationKey: generationKey(key),
        writtenKey: cacheWrittenMarkerKeyFor(key),
        lockKey: singleFlightLockKey(key),
      },
      captured,
      holder,
      ttlSeconds,
      payload,
    );
    if (published) meterLargeWrite(key, payload, ttlSeconds, 'cache');
    else incrementCounter('cache.publish.skipped', 1, { accessor: cacheAccessor(key) });
  } catch (error) {
    log.error(`Cache write error for key ${key}:`, error);
  }
};

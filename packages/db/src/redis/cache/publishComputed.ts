/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis, infrastructure:observability
 * @uses none
 */
import { epochKey } from '@template/db/redis/cache/generation/epochKey';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import type { Generation } from '@template/db/redis/cache/generation/readGeneration';
import { publishIfCurrent } from '@template/db/redis/cache/queries/publishIfCurrent';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import type { RedisEval } from '@template/db/redis/types';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';

// Publishes a computed value unless a clear ran while it was computed. A skipped publish is counted by accessor; a failed one is logged. Neither throws: the caller already
// has its value.
export const publishComputed = async (
  redis: RedisEval,
  key: string,
  captured: Generation,
  ttlSeconds: number,
  payload: string,
  shouldKeepExisting: boolean,
): Promise<void> => {
  try {
    const published = await publishIfCurrent(
      redis,
      { key, generationKey: generationKey(key), epochKey: epochKey(), writtenKey: writtenKey(key) },
      captured,
      ttlSeconds,
      payload,
      shouldKeepExisting,
    );
    if (published === 1) meterLargeWrite(key, payload, ttlSeconds, 'cache');
    else if (published === 0) {
      incrementCounter('cache.publish.skipped', 1, { accessor: cacheAccessor(key) });
    }
  } catch (error) {
    log.error(`Cache write error for key ${key}:`, error);
  }
};

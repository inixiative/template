/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import {
  GENERATION_TTL_SECONDS,
  newGeneration,
} from '@template/db/redis/cache/generation/newGeneration';
import { publishAtCommit } from '@template/db/redis/cache/queries/publishAtCommit';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import type { CacheOverlay } from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import { incrementCounter } from '@template/shared/telemetry';

export const publishKey = async (overlay: CacheOverlay, key: string): Promise<void> => {
  const entry = overlay.values.get(key);
  const shouldPublish = !!entry && entry.generation !== null && entry.ttlSeconds > 0;
  const shouldClear = overlay.written.has(key);
  if (!shouldPublish && !shouldClear) return;
  const payload = shouldPublish ? entry.payload : '';

  const published = await publishAtCommit(
    getRedisClient(),
    { key, generationKey: generationKey(key), writtenKey: writtenKey(key) },
    {
      captured: entry?.generation ?? '',
      clearedGeneration: newGeneration(),
      generationTtlSeconds: GENERATION_TTL_SECONDS,
      ttlSeconds: entry?.ttlSeconds ?? 0,
      payload,
      shouldClear,
    },
  );
  if (published) meterLargeWrite(key, payload, entry?.ttlSeconds ?? 0, 'cache');
  else if (shouldPublish)
    incrementCounter('cache.publish.skipped', 1, { accessor: cacheAccessor(key) });
};

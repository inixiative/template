/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { isPattern } from '@template/db/redis/cache/cachePattern';
import { clearKey } from '@template/db/redis/cache/clearKey';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import {
  GENERATION_TTL_SECONDS,
  newGeneration,
} from '@template/db/redis/cache/generation/newGeneration';
import { publishAtCommit } from '@template/db/redis/cache/queries/publishAtCommit';
import { cacheAccessor } from '@template/db/redis/cache/telemetry/cacheAccessor';
import { meterLargeWrite } from '@template/db/redis/cache/telemetry/meterLargeWrite';
import {
  type CacheOverlay,
  isWrittenInTransaction,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';

const publishKey = async (overlay: CacheOverlay, key: string): Promise<void> => {
  const entry = overlay.values.get(key);
  const shouldPublish = !!entry && entry.generation !== null && entry.ttlSeconds > 0;
  const payload = shouldPublish ? entry.payload : '';

  try {
    const published = await publishAtCommit(
      getRedisClient(),
      { key, generationKey: generationKey(key), writtenKey: writtenKey(key) },
      {
        captured: entry?.generation ?? '',
        clearedGeneration: newGeneration(),
        generationTtlSeconds: GENERATION_TTL_SECONDS,
        ttlSeconds: entry?.ttlSeconds ?? 0,
        payload,
        shouldClear: isWrittenInTransaction(overlay, key),
      },
    );
    if (published) meterLargeWrite(key, payload, entry?.ttlSeconds ?? 0, 'cache');
    else if (shouldPublish)
      incrementCounter('cache.publish.skipped', 1, { accessor: cacheAccessor(key) });
  } catch (error) {
    log.error(`Cache publish at commit failed for key ${key}:`, error);
  }
};

export const publishOverlay = async (overlay: CacheOverlay): Promise<void> => {
  const patterns = [...overlay.written].filter(isPattern);
  const keys = new Set([
    ...overlay.values.keys(),
    ...[...overlay.written].filter((key) => !isPattern(key)),
  ]);
  const concurrency = getConcurrency([ConcurrencyType.redis]);
  await resolveAll(
    [...keys].map((key) => () => publishKey(overlay, key)),
    concurrency,
  );
  await resolveAll(
    patterns.map((pattern) => () => clearKey(pattern)),
    concurrency,
  );
};

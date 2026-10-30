/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

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
  isPattern,
  isWrittenInTransaction,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { writtenKey } from '@template/db/redis/cache/writtenKey';
import { getRedisClient } from '@template/db/redis/client';
import { log } from '@template/shared/logger';
import { incrementCounter } from '@template/shared/telemetry';
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';
import superjson from 'superjson';

const publishKey = async (overlay: CacheOverlay, key: string): Promise<void> => {
  const entry = overlay.values.get(key);
  const shouldPublish = !!entry && entry.generation !== null && entry.ttlSeconds > 0;
  const payload = shouldPublish ? superjson.stringify(entry.value) : '';

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
  const touched = [...new Set([...overlay.written, ...overlay.values.keys()])];
  const concurrency = getConcurrency([ConcurrencyType.redis]);
  await resolveAll(
    touched.filter((key) => !isPattern(key)).map((key) => () => publishKey(overlay, key)),
    concurrency,
  );
  await resolveAll(
    touched.filter(isPattern).map((pattern) => () => clearKey(pattern)),
    concurrency,
  );
};

/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { isPattern, matchesPattern } from '@template/db/redis/cache/cachePattern';
import { clearKey } from '@template/db/redis/cache/clearKey';
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
import { ConcurrencyType, getConcurrency, resolveAll } from '@template/shared/utils';

const publishKey = async (overlay: CacheOverlay, key: string): Promise<void> => {
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

const failureOf = (fn: () => Promise<unknown>) => async (): Promise<unknown> => {
  try {
    await fn();
    return null;
  } catch (error) {
    return error;
  }
};

export const publishOverlay = async (overlay: CacheOverlay): Promise<unknown[]> => {
  const patterns = [...overlay.written].filter(isPattern);
  const keys = new Set(
    [...overlay.values.keys(), ...overlay.written].filter(
      (key) => !isPattern(key) && !patterns.some((pattern) => matchesPattern(pattern, key)),
    ),
  );
  const concurrency = getConcurrency([ConcurrencyType.redis]);
  const failures = [
    ...(await resolveAll(
      [...keys].map((key) => failureOf(() => publishKey(overlay, key))),
      concurrency,
    )),
    ...(await resolveAll(
      patterns.map((pattern) => failureOf(() => clearKey(pattern))),
      concurrency,
    )),
  ];
  return failures.filter((failure) => failure !== null);
};

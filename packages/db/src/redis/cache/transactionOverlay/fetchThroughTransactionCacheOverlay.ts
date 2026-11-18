/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */

import { fetchCachedValue } from '@template/db/redis/cache/fetchCachedValue';
import { fetchCacheGeneration } from '@template/db/redis/cache/generation/fetchCacheGeneration';
import { resolveTtl } from '@template/db/redis/cache/resolveTtl';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import {
  type CacheOverlay,
  isWrittenInTransaction,
  onOverlayKey,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { redisClient } from '@template/db/redis/client';
import superjson from 'superjson';

export const fetchThroughTransactionCacheOverlay = <T>(
  overlay: CacheOverlay,
  key: string,
  fn: () => Promise<T>,
  ttl: number | ((value: T) => number),
  setResult: (result: CacheResult) => void,
): Promise<T> =>
  onOverlayKey(overlay, key, async () => {
    const held = overlay.values.get(key);
    if (held) {
      setResult('hit');
      return superjson.parse<T>(held.payload);
    }

    const redis = redisClient();
    if (!isWrittenInTransaction(overlay, key)) {
      const cached = await fetchCachedValue<T>(redis, key);
      setResult(cached.result);
      if (cached.result === 'hit') return cached.value;
    }

    const generation = await fetchCacheGeneration(redis, key);
    const value = await fn();
    overlay.values.set(key, {
      payload: superjson.stringify(value),
      ttlSeconds: resolveTtl(value, ttl),
      generation,
    });
    return value;
  });

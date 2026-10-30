/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { readGeneration } from '@template/db/redis/cache/generation/readGeneration';
import { readCached } from '@template/db/redis/cache/readCached';
import { resolveTtl } from '@template/db/redis/cache/resolveTtl';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import {
  type CacheOverlay,
  isWrittenInTransaction,
  onOverlayKey,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { getRedisClient } from '@template/db/redis/client';

export const readInTransaction = <T>(
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
      return held.value as T;
    }

    const redis = getRedisClient();
    if (!isWrittenInTransaction(overlay, key)) {
      const cached = await readCached<T>(redis, key);
      setResult(cached.result);
      if (cached.result === 'hit') return cached.value;
    }

    const generation = await readGeneration(redis, key);
    const value = await fn();
    overlay.values.set(key, { value, ttlSeconds: resolveTtl(value, ttl), generation });
    return value;
  });

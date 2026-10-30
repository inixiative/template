/**
 * @atlas
 * @kind service
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { readCached } from '@template/db/redis/cache/readCached';
import type { CacheResult } from '@template/db/redis/cache/telemetry/withCacheSpan';
import {
  type CacheOverlay,
  onOverlayKey,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';
import { getRedisClient } from '@template/db/redis/client';

export const readInTransaction = <T>(
  overlay: CacheOverlay,
  key: string,
  fn: () => Promise<T>,
  setResult: (result: CacheResult) => void,
): Promise<T> =>
  onOverlayKey(overlay, key, async () => {
    if (overlay.values.has(key)) {
      setResult('hit');
      return overlay.values.get(key) as T;
    }

    if (!overlay.written.has(key)) {
      const cached = await readCached<T>(getRedisClient(), key);
      setResult(cached.result);
      if (cached.result === 'hit') return cached.value;
    }

    const value = await fn();
    overlay.values.set(key, value);
    return value;
  });

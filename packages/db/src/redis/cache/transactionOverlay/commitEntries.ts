/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, infrastructure:redis
 * @uses none
 */
import { cacheWrittenMarkerKeyFor } from '@template/db/redis/cache/cacheWrittenMarkerKeyFor';
import { generationKey } from '@template/db/redis/cache/generation/generationKey';
import { newGeneration } from '@template/db/redis/cache/generation/newGeneration';
import type { CommitEntry } from '@template/db/redis/cache/queries/publishAtCommit';
import type { CacheOverlay } from '@template/db/redis/cache/transactionOverlay/cacheOverlay';

export const commitEntries = (overlay: CacheOverlay, keys: string[]): CommitEntry[] =>
  keys.flatMap((key) => {
    const entry = overlay.values.get(key);
    const shouldPublish = !!entry && entry.generation !== null && entry.ttlSeconds > 0;
    const shouldClear = overlay.written.has(key);
    if (!shouldPublish && !shouldClear) return [];
    return [
      {
        key,
        generationKey: generationKey(key),
        writtenKey: cacheWrittenMarkerKeyFor(key),
        captured: entry?.generation ?? '',
        clearedGeneration: newGeneration(),
        ttlSeconds: entry?.ttlSeconds ?? 0,
        payload: shouldPublish ? entry.payload : '',
        shouldClear,
      },
    ];
  });

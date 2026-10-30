/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, mutex
 * @uses primitive:shared
 */
import { isPattern, matchesPattern } from '@template/db/redis/cache/cachePattern';
import type { Generation } from '@template/db/redis/cache/generation/readGeneration';
import { createSerializedQueue, type SerializedQueue } from '@template/shared/utils';

export type OverlayEntry = { payload: string; ttlSeconds: number; generation: Generation | null };

export type CacheOverlay = {
  values: Map<string, OverlayEntry>;
  written: Set<string>;
  queues: Map<string, SerializedQueue>;
};

export const newCacheOverlay = (): CacheOverlay => ({
  values: new Map(),
  written: new Set(),
  queues: new Map(),
});

export const isWrittenInTransaction = (overlay: CacheOverlay, key: string): boolean =>
  overlay.written.has(key) ||
  [...overlay.written].some((written) => isPattern(written) && matchesPattern(written, key));

export const onOverlayKey = <T>(
  overlay: CacheOverlay,
  key: string,
  fn: () => Promise<T>,
): Promise<T> => {
  let queue = overlay.queues.get(key);
  if (!queue) {
    queue = createSerializedQueue();
    overlay.queues.set(key, queue);
  }
  return queue.run(fn);
};

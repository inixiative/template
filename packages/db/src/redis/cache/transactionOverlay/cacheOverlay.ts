/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, mutex
 * @uses primitive:shared
 */
import { createSerializedQueue, type SerializedQueue } from '@template/shared/utils';

export type CacheOverlay = {
  values: Map<string, unknown>;
  written: Set<string>;
  queues: Map<string, SerializedQueue>;
};

export const newCacheOverlay = (): CacheOverlay => ({
  values: new Map(),
  written: new Set(),
  queues: new Map(),
});

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

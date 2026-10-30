/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching, mutex
 * @uses primitive:shared
 */
import type { Generation } from '@template/db/redis/cache/generation/readGeneration';
import { createSerializedQueue, type SerializedQueue } from '@template/shared/utils';
import { escapeRegExp } from 'lodash-es';

export type OverlayEntry = { value: unknown; ttlSeconds: number; generation: Generation | null };

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

export const isPattern = (key: string): boolean => key.includes('*');

export const matchesPattern = (pattern: string, key: string): boolean =>
  new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`).test(key);

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

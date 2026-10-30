/**
 * @atlas
 * @kind service
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { db } from '@template/db/client';
import { isPattern, matchesPattern } from '@template/db/redis/cache/cachePattern';
import {
  type CacheOverlay,
  onOverlayKey,
} from '@template/db/redis/cache/transactionOverlay/cacheOverlay';

const dropHeld = (overlay: CacheOverlay, key: string): Promise<void> =>
  onOverlayKey(overlay, key, async () => {
    overlay.values.delete(key);
  });

export const markCacheWritten = async (keys: string[]): Promise<void> => {
  const overlay = db.cacheOverlay();
  if (!overlay) throw new Error('markCacheWritten() requires db.txn()');
  for (const key of keys) overlay.written.add(key);
  const touched = [...overlay.queues.keys()];
  const dropped = keys.flatMap((key) =>
    isPattern(key) ? touched.filter((held) => matchesPattern(key, held)) : [key],
  );
  await Promise.all([...new Set(dropped)].map((key) => dropHeld(overlay, key)));
};

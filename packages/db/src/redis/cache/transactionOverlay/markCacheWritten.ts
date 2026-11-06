/**
 * @atlas
 * @kind service
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { db } from '@template/db/client';
import { isPattern } from '@template/db/redis/cache/cachePattern';
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
  // why: a pattern clear at commit only finds keys holding a single-flight lock or a value in Redis; a value another transaction computed and has not published has neither, so it would publish stale.
  const pattern = keys.find(isPattern);
  if (pattern) throw new Error(`markCacheWritten() takes exact keys, not a pattern: ${pattern}`);
  for (const key of keys) overlay.written.add(key);
  await Promise.all([...new Set(keys)].map((key) => dropHeld(overlay, key)));
};

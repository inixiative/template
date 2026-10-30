/**
 * @atlas
 * @kind service
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { db } from '@template/db/client';
import { onOverlayKey } from '@template/db/redis/cache/transactionOverlay/cacheOverlay';

export const markCacheWritten = async (keys: string[]): Promise<void> => {
  const overlay = db.cacheOverlay();
  if (!overlay) return;
  await Promise.all(
    keys.map((key) =>
      onOverlayKey(overlay, key, async () => {
        overlay.values.delete(key);
        overlay.written.add(key);
      }),
    ),
  );
};

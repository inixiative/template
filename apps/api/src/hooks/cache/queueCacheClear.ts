/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { markCacheWritten, type Prisma } from '@template/db';
import { cacheKeysForRecord } from '#/hooks/cache/constants/cacheKeysByModel';

// why: writes the cache hook never sees (raw SQL shifts, ON UPDATE CASCADE) mark their keys here; the overlay clears them at commit.
export const queueCacheClear = async (
  model: Prisma.ModelName,
  records: Record<string, unknown>[],
): Promise<void> => {
  const keys = new Set(records.flatMap((record) => cacheKeysForRecord(model, record)));
  if (keys.size === 0) return;
  await markCacheWritten([...keys]);
};

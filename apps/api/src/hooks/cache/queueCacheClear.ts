/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { markCacheWritten, type Prisma } from '@template/db';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';

// why: writes the cache hook never sees (raw SQL shifts, ON UPDATE CASCADE) mark their keys here; the overlay clears them at commit.
export const queueCacheClear = async (
  model: Prisma.ModelName,
  records: Record<string, unknown>[],
): Promise<void> => {
  const keys = new Set(records.flatMap((record) => fetchCacheKeys(model, record)));
  if (keys.size === 0) return;
  await markCacheWritten([...keys]);
};

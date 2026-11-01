/**
 * @atlas
 * @kind helper
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { clearKey, db, type Prisma } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';

// why: writes the cache hook never sees (raw SQL shifts, ON UPDATE CASCADE) queue their invalidation here.
export const queueCacheClear = (model: Prisma.ModelName, records: Record<string, unknown>[]) => {
  const keys = new Set(records.flatMap((record) => fetchCacheKeys(model, record)));
  if (keys.size === 0) return;
  db.onCommit(
    [...keys].map((key) => async () => {
      await clearKey(key);
    }),
    ConcurrencyType.redis,
  );
};

import { clearKey, db, type Prisma } from '@template/db';
import { ConcurrencyType } from '@template/shared/utils';
import { castArray } from 'lodash-es';
import { fetchCacheKeys } from '#/hooks/cache/constants/cacheReference';

export const extractRows = (args: unknown): Record<string, unknown>[] => {
  if (!args || typeof args !== 'object') return [];
  const a = args as Record<string, unknown>;
  if (a.data === undefined) return [];
  return castArray(a.data) as Record<string, unknown>[];
};

// orderedList cascades shift sibling rows via raw SQL, which bypasses the
// mutation lifecycle extension — so the cache hook never fires for them. The
// `position` field is also globally ignored (see ignoreFields registry), which
// makes ordering-only updates look like no-ops to the cache hook even for the
// originating row. We compensate here: queue a cache invalidation per affected
// row on commit, using the same fetchCacheKeys / clearKey primitives the
// cache hook uses.
export const queueOrderedListCacheInvalidation = (model: string, rows: Record<string, unknown>[]): void => {
  if (rows.length === 0) return;

  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of fetchCacheKeys(model as Prisma.ModelName, row)) keys.add(key);
  }
  if (keys.size === 0) return;

  const clearKeys = [...keys].map((key) => async () => {
    await clearKey(key);
  });
  db.onCommit(clearKeys, ConcurrencyType.redis);
};

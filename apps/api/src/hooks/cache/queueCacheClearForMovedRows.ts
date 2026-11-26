/**
 * @atlas
 * @kind utils
 * @partOf primitive:caching
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import { cacheKeysByModel } from '#/hooks/cache/constants/cacheKeysByModel';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

type MovedRows = { where: Record<string, unknown>; priorValues: Record<string, unknown> };

/** Clears the cache keys of every cached row `movedRowsOf` finds, as it is now and as it was before its `priorValues` changed. */
export const queueCacheClearForMovedRows = async (
  movedRowsOf: (model: Prisma.ModelName) => MovedRows[],
): Promise<void> => {
  for (const model of Object.keys(cacheKeysByModel) as Prisma.ModelName[]) {
    for (const { where, priorValues } of movedRowsOf(model)) {
      const rows = (await db.withDeleted(() => db.delegate(model).findMany({ where }))) as Record<
        string,
        unknown
      >[];
      await queueCacheClear(model, [...rows, ...rows.map((row) => ({ ...row, ...priorValues }))]);
    }
  }
};

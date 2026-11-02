/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:caching
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import { cacheReference } from '#/hooks/cache/constants/cacheReference';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';
import { spaceKeyColumns } from '#/modules/inquiry/handlers/transferSpace/spaceKeyColumns';

// why: the space's organization reaches these rows by ON UPDATE CASCADE, which the cache hook never sees.
export const clearSpaceRowCaches = async (spaceId: string, organizationId: string) => {
  for (const model of Object.keys(cacheReference) as Prisma.ModelName[]) {
    for (const { spaceField, organizationField } of spaceKeyColumns(model)) {
      const rows = (await db.withDeleted(() =>
        db.delegate(model).findMany({ where: { [spaceField]: spaceId } }),
      )) as Record<string, unknown>[];
      queueCacheClear(model, [
        ...rows,
        ...rows.map((row) => ({ ...row, [organizationField]: organizationId })),
      ]);
    }
  }
};

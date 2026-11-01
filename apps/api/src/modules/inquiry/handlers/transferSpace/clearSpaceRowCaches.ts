/**
 * @atlas
 * @kind service
 * @partOf feature:inquiry, primitive:caching
 * @uses infrastructure:prisma
 */
import { db, lookupField, type Prisma } from '@template/db';
import { cacheReference } from '#/hooks/cache/constants/cacheReference';
import { queueCacheClear } from '#/hooks/cache/queueCacheClear';

// why: the space's organization reaches these rows by ON UPDATE CASCADE, which the cache hook never sees.
export const clearSpaceRowCaches = async (spaceId: string, organizationId: string) => {
  const models = (Object.keys(cacheReference) as Prisma.ModelName[]).filter(
    (model) => model !== 'Space' && lookupField(model, 'spaceId'),
  );
  for (const model of models) {
    const rows = (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { spaceId } }),
    )) as Record<string, unknown>[];
    queueCacheClear(model, [...rows, ...rows.map((row) => ({ ...row, organizationId }))]);
  }
};

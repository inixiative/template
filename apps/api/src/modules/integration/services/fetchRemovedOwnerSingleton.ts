/**
 * @atlas
 * @kind query
 * @partOf feature:integrations
 * @uses infrastructure:prisma
 */
import { db, type Prisma } from '@template/db';
import { isIntegrationSingleton } from '@template/shared/integrations/integrationSingletons';
import { integrationOwnerKey } from '#/modules/integration/services/integrationOwnerKey';

export const fetchRemovedOwnerSingleton = async (row: Prisma.IntegrationUncheckedCreateInput) => {
  if (!isIntegrationSingleton(row.provider, 'owner')) return null;
  const owner = integrationOwnerKey(row);
  const live = await db.integration.findFirst({ where: owner, select: { id: true } });
  if (live) return null;
  return db.withDeleted(() =>
    db.integration.findFirst({
      where: { ...owner, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: { id: true },
    }),
  );
};

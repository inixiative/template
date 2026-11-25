/**
 * @atlas
 * @kind query
 * @partOf feature:integrations
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db, type Prisma } from '@template/db';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { pickBy } from 'lodash-es';
import { integrationOwnerKey } from '#/modules/integration/services/integrationOwnerKey';

export const fetchOnePerOwnerIntegrationForUpdate = async (
  row: Prisma.IntegrationUncheckedCreateInput,
) => {
  if (!isIntegrationOnePer(row.provider, 'owner')) return null;
  const owner = integrationOwnerKey(row);
  await db.findForUpdate(
    'Integration',
    pickBy(owner, (value) => value !== null),
    { upserting: true },
  );
  return db.withDeleted(() =>
    db.integration.findFirst({
      where: owner,
      orderBy: { deletedAt: { sort: 'desc', nulls: 'first' } },
      select: { id: true, deletedAt: true },
    }),
  );
};

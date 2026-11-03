/**
 * @atlas
 * @kind controller
 * @partOf feature:users
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { includeTargetEntitlements, type Prisma, withEntitlementEntries } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { meReadManyIntegrationsRoute } from '#/modules/me/routes/meReadManyIntegrations';

export const meReadManyIntegrationsController = makeController(
  meReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate<
      typeof db.integration,
      Prisma.IntegrationGetPayload<{ include: typeof includeTargetEntitlements }>
    >(c, db.integration, {
      include: includeTargetEntitlements,
      where: submodelOwnerWhere(c),
    });
    return respond.ok(
      data.map((row) => withEntitlementEntries(row)),
      { pagination },
    );
  },
);

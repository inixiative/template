/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import { includeTargetEntitlements, type Prisma } from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceReadManyIntegrationsRoute } from '#/modules/space/routes/spaceReadManyIntegrations';

export const spaceReadManyIntegrationsController = makeController(
  spaceReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate<
      typeof db.integration,
      Prisma.IntegrationGetPayload<{ include: typeof includeTargetEntitlements }>
    >(c, db.integration, {
      include: includeTargetEntitlements,
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);

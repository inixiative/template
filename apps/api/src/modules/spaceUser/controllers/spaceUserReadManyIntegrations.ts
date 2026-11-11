/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma, feature:integrations
 */
import {
  type IncludeTargetEntitlements,
  includeTargetEntitlements,
  type Prisma,
} from '@template/db';
import { paginate } from '#/lib/prisma/paginate';
import { submodelOwnerWhere } from '#/lib/prisma/submodelOwnerWhere';
import { makeController } from '#/lib/utils/makeController';
import { spaceUserReadManyIntegrationsRoute } from '#/modules/spaceUser/routes/spaceUserReadManyIntegrations';

export const spaceUserReadManyIntegrationsController = makeController(
  spaceUserReadManyIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { data, pagination } = await paginate<
      typeof db.integration,
      Prisma.IntegrationGetPayload<{ include: IncludeTargetEntitlements }>
    >(c, db.integration, {
      include: includeTargetEntitlements('Integration'),
      where: submodelOwnerWhere(c),
    });
    return respond.ok(data, { pagination });
  },
);

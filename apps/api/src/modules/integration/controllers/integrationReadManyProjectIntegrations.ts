/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadManyProjectIntegrationsRoute } from '#/modules/integration/routes/integrationReadManyProjectIntegrations';

export const integrationReadManyProjectIntegrationsController = makeController(
  integrationReadManyProjectIntegrationsRoute,
  async (c, respond) => {
    const db = c.get('db');
    const permix = c.get('permix');
    const integration = contextResource<'integration'>(c);

    const candidates = await db.projectIntegration.findMany({
      where: { integrationId: integration.id, project: { deletedAt: null } },
    });
    const allowed = await Promise.all(
      candidates.map((row) => holdsOnRecord(permix, 'projectIntegration', row, 'read')),
    );
    const readableIds = candidates.filter((_row, index) => allowed[index]).map((row) => row.id);

    const { data, pagination } = await paginate(c, db.projectIntegration, {
      where: { integrationId: integration.id, id: { in: readableIds } },
      include: {
        project: true,
        projectIntegrationResources: { where: { deletedAt: null } },
      },
    });
    return respond.ok(data, { pagination });
  },
);

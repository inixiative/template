/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import { type HydratedRecord, hydrateMany } from '@template/db';
import { IntegrationResourceStatus } from '@template/db/generated/client/enums';
import { check } from '@template/permissions/rebac';
import { contextResource } from '#/lib/context/contextResource';
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
      where: { integrationId: integration.id },
    });
    const hydrated = await hydrateMany('projectIntegration', candidates);
    const readableIds = hydrated
      .filter((row) => {
        const project = (row as HydratedRecord & { project?: HydratedRecord }).project;
        return (
          Boolean(project) &&
          check(permix, 'projectIntegration', row, 'read') &&
          check(permix, 'project', project!, 'read')
        );
      })
      .map((row) => row.id);

    const { data, pagination } = await paginate(c, db.projectIntegration, {
      where: { integrationId: integration.id, id: { in: readableIds } },
      include: {
        project: true,
        projectIntegrationResources: {
          where: {
            integrationResource: { status: { not: IntegrationResourceStatus.untracked } },
          },
        },
      },
    });
    return respond.ok(data, { pagination });
  },
);

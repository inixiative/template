/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz, infrastructure:prisma
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateManyProjectIntegrationsRoute } from '#/modules/integration/routes/integrationCreateManyProjectIntegrations';
import { createManyIntegrationProjectIntegrations } from '#/modules/integration/services/createManyIntegrationProjectIntegrations';

export const integrationCreateManyProjectIntegrationsController = makeController(
  integrationCreateManyProjectIntegrationsRoute,
  async (c, respond) => {
    const integration = contextResource<'integration'>(c);
    const items = c.req.valid('json');
    const links = await createManyIntegrationProjectIntegrations(
      c.get('permix'),
      integration.id,
      items,
    );
    return respond.created(links);
  },
);

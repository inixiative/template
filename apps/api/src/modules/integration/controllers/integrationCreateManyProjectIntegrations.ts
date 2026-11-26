/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations, feature:project
 * @uses primitive:routeTemplates, primitive:authz
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationCreateManyProjectIntegrationsRoute } from '#/modules/integration/routes/integrationCreateManyProjectIntegrations';
import { createManyIntegrationProjectIntegrations } from '#/modules/integration/services/createManyIntegrationProjectIntegrations';

export const integrationCreateManyProjectIntegrationsController = makeController(
  integrationCreateManyProjectIntegrationsRoute,
  async (c, respond) => {
    const permix = c.get('permix');
    const integration = contextResource<'integration'>(c);
    const items = c.req.valid('json');
    const projectIntegrations = await createManyIntegrationProjectIntegrations(
      permix,
      integration.id,
      items,
    );
    return respond.created(projectIntegrations);
  },
);

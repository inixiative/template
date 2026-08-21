/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadRoute } from '#/modules/integration/routes/integrationRead';

export const integrationReadController = makeController(integrationReadRoute, async (c, respond) => {
  const integration = getResource<'integration'>(c);
  return respond.ok(integration);
});

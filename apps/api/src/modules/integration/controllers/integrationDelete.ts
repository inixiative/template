/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationDeleteRoute } from '#/modules/integration/routes/integrationDelete';

export const integrationDeleteController = makeController(integrationDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const integration = getResource<'integration'>(c);
  await db.integration.delete({ where: { id: integration.id } });
  return respond.noContent();
});

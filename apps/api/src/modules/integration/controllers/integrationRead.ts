/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements } from '@template/db';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadRoute } from '#/modules/integration/routes/integrationRead';

export const integrationReadController = makeController(
  integrationReadRoute,
  async (c, respond) => {
    const integration = contextResource<'integration'>(c);
    const loaded = await c.get('db').integration.findUniqueOrThrow({
      where: { id: integration.id },
      include: includeTargetEntitlements('Integration'),
    });
    return respond.ok(loaded);
  },
);

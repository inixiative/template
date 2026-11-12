/**
 * @atlas
 * @kind controller
 * @partOf feature:integrations
 * @uses primitive:routeTemplates
 */
import { includeTargetEntitlements } from '@template/db';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { integrationReadRoute } from '#/modules/integration/routes/integrationRead';

export const integrationReadController = makeController(
  integrationReadRoute,
  async (c, respond) => {
    const integration = getResource<'integration'>(c);
    const loaded = await c.get('db').integration.findUniqueOrThrow({
      where: { id: integration.id },
      include: includeTargetEntitlements('Integration'),
    });
    return respond.ok(loaded);
  },
);
